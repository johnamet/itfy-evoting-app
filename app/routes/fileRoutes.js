#!/usr/bin/env node
/**
 * File Routes
 * 
 * Defines API endpoints for file management operations.
 */

import express from 'express';
import multer from 'multer';
import FileController from '../controllers/FileController.js';
import { 
    optionalAuth, 
    requireCreate, 
    requireRead, 
    requireUpdate, 
    requireDelete,
    requireLevel 
} from '../middleware/auth.js';

const router = express.Router();
const fileController = new FileController();

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/temp/' });

// File upload operations
router.post('/upload', requireCreate, upload.single('file'), (req, res) => fileController.uploadFile(req, res));
router.post('/upload/multiple', requireCreate, upload.array('files', 10), (req, res) => fileController.uploadMultipleFiles(req, res));
router.post('/validate', requireRead, upload.single('file'), (req, res) => fileController.validateFile(req, res));

// File operations
router.get('/', requireRead, (req, res) => fileController.getFiles(req, res));
router.get('/:id', optionalAuth, (req, res) => fileController.getFileById(req, res));
router.get('/:id/download', optionalAuth, (req, res) => fileController.downloadFile(req, res));
router.get('/:id/thumbnail', optionalAuth, (req, res) => fileController.getFileThumbnail(req, res));
router.put('/:id', requireUpdate, (req, res) => fileController.updateFileMetadata(req, res));
router.delete('/:id', requireDelete, (req, res) => fileController.deleteFile(req, res));

// File by entity
router.get('/entity/:entityType/:entityId', optionalAuth, (req, res) => fileController.getFilesByEntity(req, res));

// File management
router.post('/:id/download-link', requireRead, (req, res) => fileController.generateDownloadLink(req, res));
router.get('/admin/stats', requireLevel(3), (req, res) => fileController.getStorageStats(req, res));
router.delete('/admin/cleanup-temp', requireLevel(3), (req, res) => fileController.cleanupTempFiles(req, res));

export default router;
