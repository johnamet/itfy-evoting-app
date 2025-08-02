#!/usr/bin/env node
/**
 * File Controller
 * 
 * Handles file upload, download, and management operations.
 */

import BaseController from './BaseController.js';
import FileService from '../services/FileService.js';

export default class FileController extends BaseController {
    constructor() {
        super();
        this.fileService = new FileService();
    }

    /**
     * Upload a file
     */
    async uploadFile(req, res) {
        try {
            console.log('File upload request received:', req.file, req.body);
            const file = req.file;
            const { category, entityType, entityId } = req.body;
            const uploadedBy = req.user?.id || "688c82bc0e3aaea6fa5e73d3";

            if (!file) {
                return this.sendError(res, 'File is required', 400);
            }

            if (!uploadedBy) {
                return this.sendError(res, 'User authentication required', 401);
            }

            if (!entityType || !entityId) {
                return this.sendError(res, 'entityType and entityId are required', 400);
            }

            const uploadedFile = await this.fileService.uploadFile(file, {
                category,
                entityType,
                entityId,
                uploadedBy
            });

            const fileUrl = `/files/${uploadedFile.fileId}`;
            return this.sendSuccess(res, { ...uploadedFile, url: fileUrl }, 'File uploaded successfully', 201);
        } catch (error) {
            return this.handleError(res, error, 'Failed to upload file');
        }
    }

    /**
     * Upload multiple files
     */
    async uploadMultipleFiles(req, res) {
        try {
            const files = req.files;
            const { category, entityType, entityId } = req.body;
            const uploadedBy = req.user?.id;

            if (!files || files.length === 0) {
                return this.sendError(res, 'Files are required', 400);
            }

            if (!uploadedBy) {
                return this.sendError(res, 'User authentication required', 401);
            }

            if (!entityType || !entityId) {
                return this.sendError(res, 'entityType and entityId are required', 400);
            }

            const uploadedFiles = await this.fileService.uploadMultipleFiles(files, {
                category,
                entityType,
                entityId,
                uploadedBy
            });

            const fileUrls = uploadedFiles.map(file => ({ ...file, url: `/files/${file.fileId}` }));
            return this.sendSuccess(res, fileUrls, 'Files uploaded successfully', 201);
        } catch (error) {
            return this.handleError(res, error, 'Failed to upload files');
        }
    }

    /**
     * Get file by ID
     */
    async getFileById(req, res) {
        try {
            const { fileId } = req.params;

            const file = await this.fileService.getFileById(fileId);
            
            if (!file) {
                return this.sendError(res, 'File not found', 404);
            }

            return this.sendSuccess(res, file, 'File retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get file');
        }
    }

    /**
     * Download file
     */
    async downloadFile(req, res) {
        try {
            const { fileId } = req.params;

            const { stream, mimetype, originalName } = await this.fileService.downloadFile(fileId);

            const fileStream = stream;
            if (!fileStream) {
                return this.sendError(res, 'File not found', 404);
            }

            // Set appropriate headers
            res.setHeader('Content-Type', mimetype);
            res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);

            return fileStream.pipe(res);
        } catch (error) {
            return this.handleError(res, error, 'Failed to download file');
        }
    }

    /**
     * Get files with filtering and pagination
     */
    async getFiles(req, res) {
        try {
            const query = req.query;
            const files = await this.fileService.getFiles(query);
            return this.sendSuccess(res, files, 'Files retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get files');
        }
    }

    /**
     * Get files by entity
     */
    async getFilesByEntity(req, res) {
        try {
            const { entityType, entityId } = req.params;
            const query = req.query;

            const files = await this.fileService.getFilesByEntity(entityType, entityId, query);
            return this.sendSuccess(res, files, 'Entity files retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get entity files');
        }
    }

    /**
     * Update file metadata
     */
    async updateFileMetadata(req, res) {
        try {
            const { fileId } = req.params;
            const updateData = req.body;
            const updatedBy = req.user?.id;

            const file = await this.fileService.updateFileMetadata(fileId, {
                ...updateData,
                updatedBy
            });

            if (!file) {
                return this.sendError(res, 'File not found', 404);
            }

            return this.sendSuccess(res, file, 'File metadata updated successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to update file metadata');
        }
    }

    /**
     * Delete file
     */
    async deleteFile(req, res) {
        try {
            const { fileId } = req.params;
            const deletedBy = req.user?.id;

            const result = await this.fileService.deleteFile(fileId, deletedBy);

            if (!result) {
                return this.sendError(res, 'File not found', 404);
            }

            return this.sendSuccess(res, null, 'File deleted successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to delete file');
        }
    }

    /**
     * Get file thumbnail
     */
    async getFileThumbnail(req, res) {
        try {
            const { fileId } = req.params;
            const { size = 'medium' } = req.query;

            const thumbnail = await this.fileService.getFileThumbnail(fileId, size);
            
            if (!thumbnail) {
                return this.sendError(res, 'Thumbnail not found', 404);
            }

            res.setHeader('Content-Type', thumbnail.mimetype);
            res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours

            return thumbnail.stream.pipe(res);
        } catch (error) {
            return this.handleError(res, error, 'Failed to get file thumbnail');
        }
    }

    /**
     * Get file storage statistics
     */
    async getStorageStats(req, res) {
        try {
            const query = req.query;
            const stats = await this.fileService.getStorageStats(query);
            return this.sendSuccess(res, stats, 'Storage statistics retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get storage statistics');
        }
    }

    /**
     * Cleanup temporary files
     */
    async cleanupTempFiles(req, res) {
        try {
            const { olderThanHours = 24 } = req.query;

            // Only admins can cleanup temp files
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const result = await this.fileService.cleanupTempFiles(parseInt(olderThanHours));
            return this.sendSuccess(res, result, 'Temporary files cleaned up successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to cleanup temporary files');
        }
    }

    /**
     * Validate file before upload
     */
    async validateFile(req, res) {
        try {
            const file = req.file;
            const { category } = req.body;

            if (!file) {
                return this.sendError(res, 'File is required', 400);
            }

            const validation = await this.fileService.validateFile(file, category);
            return this.sendSuccess(res, validation, 'File validation completed');
        } catch (error) {
            return this.handleError(res, error, 'File validation failed');
        }
    }

    /**
     * Generate secure download link
     */
    async generateDownloadLink(req, res) {
        try {
            const { fileId } = req.params;
            const { expiresIn = 3600 } = req.query; // Default 1 hour

            const downloadLink = await this.fileService.generateDownloadLink(fileId, parseInt(expiresIn));
            
            if (!downloadLink) {
                return this.sendError(res, 'File not found', 404);
            }

            return this.sendSuccess(res, downloadLink, 'Download link generated successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to generate download link');
        }
    }

    /**
     * Move file to different directory
     */
    async moveFile(req, res) {
        try {
            const { fileId } = req.params;
            const { newDirectory } = req.body;

            if (!newDirectory) {
                return this.sendError(res, 'newDirectory is required', 400);
            }

            const result = await this.fileService.moveFile(fileId, newDirectory);
            return this.sendSuccess(res, result, 'File moved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to move file');
        }
    }

    /**
     * Create file backup
     */
    async createBackup(req, res) {
        try {
            const { fileId } = req.params;

            const result = await this.fileService.createBackup(fileId);
            return this.sendSuccess(res, result, 'Backup created successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to create backup');
        }
    }
}