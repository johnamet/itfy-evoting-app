#!/usr/bin/env node
/**
 * File Service
 * 
 * Handles file and image operations including upload, validation,
 * compression, and storage management.
 */

import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import crypto from 'crypto';
import File from '../models/File.js';
import BaseService from './BaseService.js';

class FileService extends BaseService {
    constructor() {
        super();
        this.uploadPath = process.env.UPLOAD_PATH || './uploads';
        this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024; // 5MB default
        this.allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        this.allowedDocumentTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        
        // Ensure upload directories exist
        this.initializeDirectories();
    }

    /**
     * Initialize upload directories
     */
    async initializeDirectories() {
        try {
            const directories = [
                this.uploadPath,
                path.join(this.uploadPath, 'images'),
                path.join(this.uploadPath, 'candidates'),
                path.join(this.uploadPath, 'events'),
                path.join(this.uploadPath, 'documents'),
                path.join(this.uploadPath, 'temp'),
                path.join(this.uploadPath, 'backups'),
            
            ];

            for (const dir of directories) {
                try {
                    await fsPromises.access(dir);
                } catch (error) {
                    await fsPromises.mkdir(dir, { recursive: true });
                    console.log(`Created directory: ${dir}`);
                }
            }
        } catch (error) {
            console.error('Error initializing directories:', error.message);
        }
    }

    /**
     * Validate file data
     * @param {Object} fileData - File data object
     * @param {String} fileType - Type of file (image, document)
     * @returns {Object} Validation result
     */
    validateFile(fileData, fileType = 'image') {
        try {
            this._log('validate_file', { fileName: fileData.originalname, fileType, size: fileData.size });

            if (!fileData || !fileData.buffer) {
                throw new Error('No file data provided');
            }

            if (!fileData.originalname || typeof fileData.originalname !== 'string') {
                throw new Error('Invalid file name');
            }

            if (!fileData.mimetype || typeof fileData.mimetype !== 'string') {
                throw new Error('Invalid file type');
            }

            if (!fileData.size || fileData.size <= 0) {
                throw new Error('Invalid file size');
            }

            // Check file size
            if (fileData.size > this.maxFileSize) {
                throw new Error(`File size exceeds maximum allowed size of ${this.maxFileSize / (1024 * 1024)}MB`);
            }

            // Check file type
            const allowedTypes = fileType === 'image' ? this.allowedImageTypes : this.allowedDocumentTypes;
            if (!allowedTypes.includes(fileData.mimetype)) {
                throw new Error(`File type ${fileData.mimetype} is not allowed for ${fileType} files`);
            }

            // Validate file extension
            const fileExtension = path.extname(fileData.originalname).toLowerCase();
            const mimeToExt = {
                'image/jpeg': ['.jpg', '.jpeg'],
                'image/png': ['.png'],
                'image/gif': ['.gif'],
                'image/webp': ['.webp'],
                'application/pdf': ['.pdf'],
                'application/msword': ['.doc'],
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
            };

            const expectedExtensions = mimeToExt[fileData.mimetype] || [];
            if (!expectedExtensions.includes(fileExtension)) {
                throw new Error('File extension does not match file type');
            }

            return {
                valid: true,
                fileInfo: {
                    name: fileData.originalname,
                    size: fileData.size,
                    mimetype: fileData.mimetype,
                    extension: fileExtension
                }
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }

    /**
     * Generate unique filename
     * @param {String} originalName - Original filename
     * @param {String} prefix - Optional prefix
     * @returns {String} Unique filename
     */
    generateUniqueFilename(originalName, prefix = '') {
        const extension = path.extname(originalName);
        const timestamp = Date.now();
        const randomString = crypto.randomBytes(8).toString('hex');
        const baseName = path.basename(originalName, extension).replace(/[^a-zA-Z0-9]/g, '_');
        
        return `${prefix}${timestamp}_${randomString}_${baseName}${extension}`;
    }

    /**
     * Upload file to specified directory
     * @param {Object} fileData - File data from multer
     * @param {Object} options - Upload options { category, entityType, entityId, uploadedBy }
     * @returns {Promise<Object>} Upload result with fileId
     */
    async uploadFile(fileData, options) {
        try {
            this._log('upload_file', { 
                fileName: fileData.originalname, 
                entityType: options.entityType, 
                entityId: options.entityId,
                size: fileData.size 
            });

            const { category, entityType, entityId, uploadedBy } = options;
            const directory = entityType === 'candidate' ? 'candidates' : entityType === 'event' ? 'events' : 'documents';
            const filename = this.generateUniqueFilename(fileData.originalname, `${entityType}_${entityId}_`);
            const targetPath = path.join(this.uploadPath, directory);
            const fullPath = path.join(targetPath, filename);

            // Ensure target directory exists
            try {
                await fsPromises.access(targetPath);
            } catch (error) {
                await fsPromises.mkdir(targetPath, { recursive: true });
            }

            // Write file
            await fsPromises.writeFile(fullPath, fileData.buffer);

            const fileStats = await fsPromises.stat(fullPath);

            // Save to File model
            const fileDoc = new File({
                filename,
                originalName: fileData.originalname,
                path: fullPath,
                relativePath: path.join(directory, filename),
                size: fileStats.size,
                mimetype: fileData.mimetype,
                uploadedBy,
                entityType,
                entityId,
                category
            });
            const savedFile = await fileDoc.save();

            this._log('upload_file_success', { 
                fileId: savedFile.fileId, 
                path: fullPath,
                size: fileStats.size 
            });

            return savedFile.toObject();
        } catch (error) {
            throw this._handleError(error, 'upload_file', { 
                fileName: fileData.originalname, 
                entityType: options.entityType,
                entityId: options.entityId 
            });
        }
    }

    /**
     * Upload multiple files
     * @param {Array<Object>} files - Array of file data from multer
     * @param {Object} options - Upload options { category, entityType, entityId, uploadedBy }
     * @returns {Promise<Array<Object>>} Array of uploaded file objects
     */
    async uploadMultipleFiles(files, options) {
        try {
            this._log('upload_multiple_files', { 
                fileCount: files.length, 
                entityType: options.entityType, 
                entityId: options.entityId 
            });

            const uploadPromises = files.map(file => this.uploadFile(file, options));
            const uploadedFiles = await Promise.all(uploadPromises);

            return uploadedFiles;
        } catch (error) {
            throw this._handleError(error, 'upload_multiple_files', { 
                entityType: options.entityType,
                entityId: options.entityId 
            });
        }
    }

    /**
     * Get file by ID
     * @param {String} fileId - File ID
     * @returns {Promise<Object>} File document
     */
    async getFileById(fileId) {
        try {
            this._log('get_file_by_id', { fileId });
            const file = await File.findOne({ fileId }).lean();
            if (!file) throw new Error('File not found');
            return file;
        } catch (error) {
            throw this._handleError(error, 'get_file_by_id', { fileId });
        }
    }

    /**
     * Download file
     * @param {String} fileId - File ID
     * @returns {Promise<Object>} Stream and metadata
     */
    async downloadFile(fileId) {
        try {
            this._log('download_file', { fileId });
            const file = await File.findOne({ fileId, status: 'processed' });
            if (!file) throw new Error('File not found');

            const stream = fs.createReadStream(file.path);

            return {
                stream,
                mimetype: file.mimetype,
                originalName: file.originalName
            };
        } catch (error) {
            throw this._handleError(error, 'download_file', { fileId });
        }
    }

    

    /**
     * Delete file
     * @param {String} fileId - File ID
     * @param {String} deletedBy - User ID who deleted
     * @returns {Promise<Object>} Deletion result
     */
    async deleteFile(fileId, deletedBy) {
        try {
            this._log('delete_file', { fileId });
            const file = await File.findOneAndUpdate(
                { fileId, status: 'processed' },
                { status: 'deleted', updatedBy: deletedBy },
                { new: true }
            );
            if (!file) throw new Error('File not found');

            await fsPromises.unlink(file.path);

            return { success: true, message: 'File deleted successfully' };
        } catch (error) {
            throw this._handleError(error, 'delete_file', { fileId });
        }
    }

    /**
     * Update file metadata
     * @param {String} fileId - File ID
     * @param {Object} updateData - Metadata to update
     * @returns {Promise<Object>} Updated file document
     */
    async updateFileMetadata(fileId, updateData) {
        try {
            this._log('update_file_metadata', { fileId });
            const file = await File.findOneAndUpdate(
                { fileId, status: 'processed' },
                { ...updateData, updatedAt: Date.now() },
                { new: true, runValidators: true }
            ).lean();
            if (!file) throw new Error('File not found');
            return file;
        } catch (error) {
            throw this._handleError(error, 'update_file_metadata', { fileId });
        }
    }

    /**
     * Get file thumbnail
     * @param {String} fileId - File ID
     * @param {String} size - Thumbnail size (e.g., 'small', 'medium')
     * @returns {Promise<Object>} Thumbnail stream and metadata
     */
    async getFileThumbnail(fileId, size) {
        try {
            this._log('get_file_thumbnail', { fileId, size });
            const file = await File.findOne({ fileId, status: 'processed' });
            if (!file || !this.allowedImageTypes.includes(file.mimetype)) throw new Error('Thumbnail not available');

            const thumbnailPath = `${file.path}_${size}.jpg`; // Placeholder for thumbnail generation logic
            const stream = await fs.readFile(thumbnailPath);
            return {
                stream,
                mimetype: 'image/jpeg'
            };
        } catch (error) {
            throw this._handleError(error, 'get_file_thumbnail', { fileId, size });
        }
    }

    /**
     * Cleanup temporary files
     * @param {Number} olderThanHours - Hours to consider files old
     * @returns {Promise<Object>} Cleanup result
     */
    async cleanupTempFiles(olderThanHours = 24) {
        try {
            this._log('cleanup_temp_files', { olderThanHours });
            const maxAge = olderThanHours * 60 * 60 * 1000;
            return await this.cleanupOldFiles('temp', maxAge);
        } catch (error) {
            throw this._handleError(error, 'cleanup_temp_files', { olderThanHours });
        }
    }

    /**
     * Get storage statistics
     * @returns {Promise<Object>} Storage statistics
     */
    async getStorageStats() {
        try {
            this._log('get_storage_stats', {});
            const stats = {
                totalFiles: 0,
                totalSize: 0,
                directories: {}
            };

            const directories = ['images', 'candidates', 'events', 'documents', 'temp'];
            for (const dir of directories) {
                const dirPath = path.join(this.uploadPath, dir);
                const dirStats = { files: 0, size: 0 };
                try {
                    const files = await fs.readdir(dirPath);
                    for (const file of files) {
                        const filePath = path.join(dirPath, file);
                        const fileStats = await fs.stat(filePath);
                        if (fileStats.isFile()) {
                            dirStats.files++;
                            dirStats.size += fileStats.size;
                        }
                    }
                } catch (error) {}
                stats.directories[dir] = dirStats;
                stats.totalFiles += dirStats.files;
                stats.totalSize += dirStats.size;
            }

            return {
                success: true,
                stats: {
                    ...stats,
                    totalSizeFormatted: `${(stats.totalSize / (1024 * 1024)).toFixed(2)} MB`,
                    generatedAt: new Date()
                }
            };
        } catch (error) {
            throw this._handleError(error, 'get_storage_stats', {});
        }
    }

    /**
     * Move file to different directory
     * @param {String} fileId - File ID
     * @param {String} newDirectory - New directory
     * @returns {Promise<Object>} Move result
     */
    async moveFile(fileId, newDirectory) {
        try {
            this._log('move_file', { fileId, newDirectory });
            const file = await File.findOne({ fileId, status: 'processed' });
            if (!file) throw new Error('File not found');

            const newPath = path.join(this.uploadPath, newDirectory, file.filename);
            await fs.rename(file.path, newPath);

            await File.findOneAndUpdate(
                { fileId },
                { path: newPath, relativePath: path.join(newDirectory, file.filename), updatedAt: Date.now() }
            );

            return {
                success: true,
                message: 'File moved successfully',
                file: { oldPath: file.relativePath, newPath: path.join(newDirectory, file.filename) }
            };
        } catch (error) {
            throw this._handleError(error, 'move_file', { fileId, newDirectory });
        }
    }

    /**
     * Create file backup
     * @param {String} fileId - File ID
     * @returns {Promise<Object>} Backup result
     */
    async createBackup(fileId) {
        try {
            this._log('create_backup', { fileId });
            const file = await File.findOne({ fileId, status: 'processed' });
            if (!file) throw new Error('File not found');

            const backupDir = path.join(this.uploadPath, 'backups');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFilename = `${timestamp}_${file.filename}`;
            const backupPath = path.join(backupDir, backupFilename);

            try {
                await fs.access(backupDir);
            } catch (error) {
                await fs.mkdir(backupDir, { recursive: true });
            }

            await fs.copyFile(file.path, backupPath);

            return {
                success: true,
                message: 'Backup created successfully',
                backup: { originalPath: file.relativePath, backupPath: path.join('backups', backupFilename) }
            };
        } catch (error) {
            throw this._handleError(error, 'create_backup', { fileId });
        }
    }

    /**
     * Get files from a specific directory
     * @param {Object} query - Query parameters
     * @param {String} query.type - Type of files (images, documents, etc.)
     * @param {Number} query.limit - Number of files to return
     * @param {Number} query.page - Page number for pagination
     * @returns {Promise<Object>} List of files
     */
    async getFiles(query = {}) {
        try {
            this._log('get_files', { query });

            const { page, limit } = this._generatePaginationOptions(query.page, query.limit, 100);
            const { type } = query;
            const filter = type ? { entityType: type } : {};

            const files = await File.find(filter)
                .skip((page - 1) * limit)
                .limit(limit)
                .lean();

            const totalFiles = await File.countDocuments(filter);

            return {
                success: true,
                data: this._formatPaginationResponse(files, totalFiles, page, limit)
            };
        } catch (error) {
            throw this._handleError(error, 'get_files', { query });
        }
    }

    /**
     * Get files by entity
     * @param {String} entityType - Entity type
     * @param {String} entityId - Entity ID
     * @param {Object} query - Query parameters
     * @returns {Promise<Object>} List of files
     */
    async getFilesByEntity(entityType, entityId, query = {}) {
        try {
            this._log('get_files_by_entity', { entityType, entityId, query });

            const { page, limit } = this._generatePaginationOptions(query.page, query.limit, 100);
            const files = await File.find({ entityType, entityId, status: 'processed' })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean();

            const totalFiles = await File.countDocuments({ entityType, entityId, status: 'processed' });

            return {
                success: true,
                data: this._formatPaginationResponse(files, totalFiles, page, limit)
            };
        } catch (error) {
            throw this._handleError(error, 'get_files_by_entity', { entityType, entityId });
        }
    }
}

export default FileService;