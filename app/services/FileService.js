#!/usr/bin/env node
/**
 * File Service
 * 
 * Handles file and image operations including upload, validation,
 * compression, and storage management.
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
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
                path.join(this.uploadPath, 'temp')
            ];

            for (const dir of directories) {
                try {
                    await fs.access(dir);
                } catch (error) {
                    await fs.mkdir(dir, { recursive: true });
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
            this._log('validate_file', { fileName: fileData.name, fileType, size: fileData.size });

            if (!fileData || !fileData.data) {
                throw new Error('No file data provided');
            }

            if (!fileData.name || typeof fileData.name !== 'string') {
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
            const fileExtension = path.extname(fileData.name).toLowerCase();
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
                    name: fileData.name,
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
     * @param {Object} fileData - File data
     * @param {String} directory - Target directory
     * @param {String} filename - Optional custom filename
     * @returns {Promise<Object>} Upload result
     */
    async uploadFile(fileData, directory, filename = null) {
        try {
            this._log('upload_file', { 
                fileName: fileData.name, 
                directory, 
                size: fileData.size 
            });

            // Generate filename if not provided
            const targetFilename = filename || this.generateUniqueFilename(fileData.name);
            const targetPath = path.join(this.uploadPath, directory);
            const fullPath = path.join(targetPath, targetFilename);

            // Ensure target directory exists
            try {
                await fs.access(targetPath);
            } catch (error) {
                await fs.mkdir(targetPath, { recursive: true });
            }

            // Write file
            await fs.writeFile(fullPath, fileData.data);

            const fileStats = await fs.stat(fullPath);

            this._log('upload_file_success', { 
                fileName: targetFilename, 
                path: fullPath,
                size: fileStats.size 
            });

            return {
                success: true,
                file: {
                    filename: targetFilename,
                    originalName: fileData.name,
                    path: fullPath,
                    relativePath: path.join(directory, targetFilename),
                    size: fileStats.size,
                    mimetype: fileData.mimetype,
                    uploadedAt: new Date()
                }
            };
        } catch (error) {
            throw this._handleError(error, 'upload_file', { 
                fileName: fileData.name, 
                directory 
            });
        }
    }

    /**
     * Upload candidate image
     * @param {Object} imageData - Image file data
     * @param {String} candidateId - Candidate ID
     * @param {String} uploadedBy - User ID who uploaded
     * @returns {Promise<Object>} Upload result
     */
    async uploadCandidateImage(imageData, candidateId, uploadedBy) {
        try {
            this._log('upload_candidate_image', { candidateId, uploadedBy });

            this._validateObjectId(candidateId, 'Candidate ID');
            this._validateObjectId(uploadedBy, 'Uploaded By User ID');

            // Validate image
            const validation = this.validateFile(imageData, 'image');
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            // Generate filename with candidate prefix
            const filename = this.generateUniqueFilename(imageData.name, `candidate_${candidateId}_`);

            // Upload to candidates directory
            const uploadResult = await this.uploadFile(imageData, 'candidates', filename);

            return {
                success: true,
                image: {
                    ...uploadResult.file,
                    candidateId,
                    uploadedBy,
                    type: 'candidate_photo'
                }
            };
        } catch (error) {
            throw this._handleError(error, 'upload_candidate_image', { candidateId });
        }
    }

    /**
     * Delete file
     * @param {String} filePath - File path (relative to upload directory)
     * @returns {Promise<Object>} Deletion result
     */
    async deleteFile(filePath) {
        try {
            this._log('delete_file', { filePath });

            if (!filePath) {
                throw new Error('File path is required');
            }

            // Construct full path
            const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.uploadPath, filePath);

            // Check if file exists
            try {
                await fs.access(fullPath);
            } catch (error) {
                throw new Error('File not found');
            }

            // Delete file
            await fs.unlink(fullPath);

            this._log('delete_file_success', { filePath: fullPath });

            return {
                success: true,
                message: 'File deleted successfully',
                deletedFile: filePath
            };
        } catch (error) {
            throw this._handleError(error, 'delete_file', { filePath });
        }
    }

    /**
     * Get file information
     * @param {String} filePath - File path
     * @returns {Promise<Object>} File information
     */
    async getFileInfo(filePath) {
        try {
            this._log('get_file_info', { filePath });

            const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.uploadPath, filePath);

            // Check if file exists
            try {
                const stats = await fs.stat(fullPath);
                
                return {
                    success: true,
                    file: {
                        path: filePath,
                        fullPath,
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime,
                        isFile: stats.isFile(),
                        isDirectory: stats.isDirectory()
                    }
                };
            } catch (error) {
                throw new Error('File not found');
            }
        } catch (error) {
            throw this._handleError(error, 'get_file_info', { filePath });
        }
    }

    /**
     * Clean up old files
     * @param {String} directory - Directory to clean
     * @param {Number} maxAge - Maximum age in milliseconds
     * @returns {Promise<Object>} Cleanup result
     */
    async cleanupOldFiles(directory, maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days default
        try {
            this._log('cleanup_old_files', { directory, maxAge });

            const targetPath = path.join(this.uploadPath, directory);
            const cutoffTime = Date.now() - maxAge;
            let deletedCount = 0;

            try {
                const files = await fs.readdir(targetPath);
                
                for (const file of files) {
                    const filePath = path.join(targetPath, file);
                    const stats = await fs.stat(filePath);
                    
                    if (stats.isFile() && stats.mtime.getTime() < cutoffTime) {
                        await fs.unlink(filePath);
                        deletedCount++;
                        console.log(`Deleted old file: ${file}`);
                    }
                }
            } catch (error) {
                console.log(`Directory ${directory} not found or empty`);
            }

            this._log('cleanup_old_files_success', { 
                directory, 
                deletedCount 
            });

            return {
                success: true,
                message: `Cleaned up ${deletedCount} old files from ${directory}`,
                deletedCount
            };
        } catch (error) {
            throw this._handleError(error, 'cleanup_old_files', { directory });
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
                const dirStats = {
                    files: 0,
                    size: 0
                };

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
                } catch (error) {
                    // Directory doesn't exist or is empty
                }

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
     * @param {String} currentPath - Current file path
     * @param {String} newDirectory - New directory
     * @param {String} newFilename - Optional new filename
     * @returns {Promise<Object>} Move result
     */
    async moveFile(currentPath, newDirectory, newFilename = null) {
        try {
            this._log('move_file', { currentPath, newDirectory, newFilename });

            const currentFullPath = path.isAbsolute(currentPath) ? currentPath : path.join(this.uploadPath, currentPath);
            const filename = newFilename || path.basename(currentPath);
            const newPath = path.join(this.uploadPath, newDirectory);
            const newFullPath = path.join(newPath, filename);

            // Ensure source file exists
            await fs.access(currentFullPath);

            // Ensure destination directory exists
            try {
                await fs.access(newPath);
            } catch (error) {
                await fs.mkdir(newPath, { recursive: true });
            }

            // Move file
            await fs.rename(currentFullPath, newFullPath);

            this._log('move_file_success', { 
                from: currentFullPath, 
                to: newFullPath 
            });

            return {
                success: true,
                message: 'File moved successfully',
                file: {
                    oldPath: currentPath,
                    newPath: path.join(newDirectory, filename),
                    filename
                }
            };
        } catch (error) {
            throw this._handleError(error, 'move_file', { currentPath, newDirectory });
        }
    }

    /**
     * Create file backup
     * @param {String} filePath - File to backup
     * @returns {Promise<Object>} Backup result
     */
    async createBackup(filePath) {
        try {
            this._log('create_backup', { filePath });

            const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.uploadPath, filePath);
            const backupDir = path.join(this.uploadPath, 'backups');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFilename = `${timestamp}_${path.basename(filePath)}`;
            const backupPath = path.join(backupDir, backupFilename);

            // Ensure backup directory exists
            try {
                await fs.access(backupDir);
            } catch (error) {
                await fs.mkdir(backupDir, { recursive: true });
            }

            // Copy file to backup
            await fs.copyFile(fullPath, backupPath);

            this._log('create_backup_success', { 
                original: fullPath, 
                backup: backupPath 
            });

            return {
                success: true,
                message: 'Backup created successfully',
                backup: {
                    originalPath: filePath,
                    backupPath: path.join('backups', backupFilename),
                    createdAt: new Date()
                }
            };
        } catch (error) {
            throw this._handleError(error, 'create_backup', { filePath });
        }
    }
}

export default FileService;
