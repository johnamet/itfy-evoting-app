#!/usr/bin/env node
/**
 * FileService
 * 
 * Handles file uploads with Multer supporting:
 * - Local storage (development)
 * - Cloud storage (production - S3/Cloudinary)
 * - Image optimization and validation
 * - File type and size restrictions
 * - Cleanup utilities
 * 
 * @module services/FileService
 * @version 2.0.0
 */

import multer from "multer";
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import config from "../config/ConfigManager.js";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class FileService {
    constructor() {
        this.uploadDir = config.get('uploads.directory') || "uploads";
        this.maxFileSize = (config.get('uploads.maxFileSize') || 5) * 1024 * 1024; // MB to bytes
        this.allowedImageTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
        this.allowedDocTypes = [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ];

        this.initializeDirectories();
    }

    async initializeDirectories() {
        const directories = [
            `${this.uploadDir}/profiles`,
            `${this.uploadDir}/candidates`,
            `${this.uploadDir}/events`,
            `${this.uploadDir}/slides`,
            `${this.uploadDir}/documents`,
            `${this.uploadDir}/temp`,
        ];

        try {
            for (const dir of directories) {
                await fs.mkdir(dir, { recursive: true });
            }
            console.log("[FileService] Upload directories initialized");
        } catch (error) {
            console.error("[FileService] Failed to create upload directories:", error);
        }
    }

    createLocalStorage(subfolder = "temp") {
        return multer.diskStorage({
            destination: async (req, file, cb) => {
                const uploadPath = path.join(this.uploadDir, subfolder);
                
                try {
                    await fs.mkdir(uploadPath, { recursive: true });
                    cb(null, uploadPath);
                } catch (error) {
                    cb(error, uploadPath);
                }
            },
            filename: (req, file, cb) => {
                const userId = req.user?._id || req.user?.id || "anonymous";
                const timestamp = Date.now();
                const uniqueId = uuidv4().split("-")[0];
                const ext = path.extname(file.originalname);
                const nameWithoutExt = path.basename(file.originalname, ext)
                    .replace(/[^a-zA-Z0-9]/g, "_")
                    .substring(0, 30);

                const filename = `${userId}_${timestamp}_${uniqueId}_${nameWithoutExt}${ext}`;
                cb(null, filename);
            },
        });
    }

    imageFilter(req, file, cb) {
        if (this.allowedImageTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Invalid image type. Allowed: ${this.allowedImageTypes.join(", ")}`), false);
        }
    }

    documentFilter(req, file, cb) {
        if (this.allowedDocTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Invalid document type. Allowed: PDF, DOC, DOCX`), false);
        }
    }

    get uploadProfilePhoto() {
        return multer({
            storage: this.createLocalStorage("profiles"),
            fileFilter: this.imageFilter.bind(this),
            limits: { fileSize: this.maxFileSize, files: 1 },
        }).single("photo");
    }

    get uploadCandidatePhoto() {
        return multer({
            storage: this.createLocalStorage("candidates"),
            fileFilter: this.imageFilter.bind(this),
            limits: { fileSize: this.maxFileSize, files: 1 },
        }).single("photo");
    }

    get uploadEventBanner() {
        return multer({
            storage: this.createLocalStorage("events"),
            fileFilter: this.imageFilter.bind(this),
            limits: { fileSize: this.maxFileSize, files: 1 },
        }).single("banner");
    }

    get uploadSlideImage() {
        return multer({
            storage: this.createLocalStorage("slides"),
            fileFilter: this.imageFilter.bind(this),
            limits: { fileSize: this.maxFileSize, files: 1 },
        }).single("image");
    }

    get uploadDocument() {
        return multer({
            storage: this.createLocalStorage("documents"),
            fileFilter: this.documentFilter.bind(this),
            limits: { fileSize: this.maxFileSize, files: 1 },
        }).single("document");
    }

    uploadFile(fieldName = "file", subfolder = "temp") {
        return multer({
            storage: this.createLocalStorage(subfolder),
            limits: { fileSize: this.maxFileSize, files: 1 },
        }).single(fieldName);
    }

    async optimizeImage(filePath, options = {}) {
        const {
            width = 800,
            height = 800,
            quality = 80,
            format = "jpeg",
            fit = "inside",
        } = options;

        try {
            const ext = `.${format}`;
            const optimizedPath = filePath.replace(path.extname(filePath), `_optimized${ext}`);

            const sharpInstance = sharp(filePath).resize(width, height, { fit, withoutEnlargement: true });
            
            if (format === "jpeg") {
                await sharpInstance.jpeg({ quality }).toFile(optimizedPath);
            } else if (format === "png") {
                await sharpInstance.png({ quality }).toFile(optimizedPath);
            } else if (format === "webp") {
                await sharpInstance.webp({ quality }).toFile(optimizedPath);
            } else {
                await sharpInstance.toFile(optimizedPath);
            }

            await fs.unlink(filePath);
            return optimizedPath;
        } catch (error) {
            console.error("[FileService] Image optimization failed:", error);
            throw new Error("Failed to optimize image");
        }
    }

    async createThumbnail(filePath, size = 150) {
        try {
            const ext = path.extname(filePath);
            const thumbnailPath = filePath.replace(ext, `_thumb${ext}`);

            await sharp(filePath)
                .resize(size, size, { fit: "cover" })
                .jpeg({ quality: 70 })
                .toFile(thumbnailPath);

            return thumbnailPath;
        } catch (error) {
            console.error("[FileService] Thumbnail creation failed:", error);
            throw new Error("Failed to create thumbnail");
        }
    }

    async deleteFile(filePath) {
        try {
            const absolutePath = path.isAbsolute(filePath)
                ? filePath
                : path.join(process.cwd(), filePath.replace(/^\//, ""));

            await fs.unlink(absolutePath);
            console.log(`[FileService] File deleted: ${filePath}`);
            return true;
        } catch (error) {
            console.error(`[FileService] Failed to delete file ${filePath}:`, error.message);
            return false;
        }
    }

    async moveFile(sourcePath, destinationPath) {
        try {
            const destDir = path.dirname(destinationPath);
            await fs.mkdir(destDir, { recursive: true });
            await fs.rename(sourcePath, destinationPath);
            return destinationPath;
        } catch (error) {
            console.error("[FileService] File move failed:", error);
            throw new Error("Failed to move file");
        }
    }

    async getFileMetadata(filePath) {
        try {
            const stats = await fs.stat(filePath);
            return {
                size: stats.size,
                sizeInMB: (stats.size / (1024 * 1024)).toFixed(2),
                created: stats.birthtime,
                modified: stats.mtime,
                isFile: stats.isFile(),
                isDirectory: stats.isDirectory(),
            };
        } catch (error) {
            console.error("[FileService] Failed to get file metadata:", error);
            return null;
        }
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    handleUploadError(err, req, res, next) {
        if (err instanceof multer.MulterError) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({
                    success: false,
                    error: "File too large",
                    message: `File size must not exceed ${this.maxFileSize / (1024 * 1024)}MB`,
                });
            }
            if (err.code === "LIMIT_FILE_COUNT") {
                return res.status(400).json({
                    success: false,
                    error: "Too many files",
                    message: err.message,
                });
            }
            if (err.code === "LIMIT_UNEXPECTED_FILE") {
                return res.status(400).json({
                    success: false,
                    error: "Unexpected field",
                    message: "Unexpected file field in request",
                });
            }

            return res.status(400).json({
                success: false,
                error: "Upload error",
                message: err.message,
            });
        }

        if (err) {
            return res.status(400).json({
                success: false,
                error: "File upload failed",
                message: err.message,
            });
        }

        next();
    }

    async cleanupTempFiles(olderThanDays = 7) {
        try {
            const tempDir = path.join(this.uploadDir, "temp");
            const files = await fs.readdir(tempDir);
            const cutoffDate = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

            let deletedCount = 0;

            for (const file of files) {
                const filePath = path.join(tempDir, file);
                const stats = await fs.stat(filePath);

                if (stats.mtimeMs < cutoffDate) {
                    await fs.unlink(filePath);
                    deletedCount++;
                }
            }

            console.log(`[FileService] Cleaned up ${deletedCount} temporary files`);
            return deletedCount;
        } catch (error) {
            console.error("[FileService] Cleanup failed:", error);
            return 0;
        }
    }

    async getStorageStats() {
        try {
            const directories = ["profiles", "candidates", "events", "slides", "documents", "temp"];
            const stats = {};

            for (const dir of directories) {
                const dirPath = path.join(this.uploadDir, dir);
                const files = await fs.readdir(dirPath);
                
                let totalSize = 0;
                for (const file of files) {
                    const filePath = path.join(dirPath, file);
                    const stat = await fs.stat(filePath);
                    if (stat.isFile()) {
                        totalSize += stat.size;
                    }
                }

                stats[dir] = {
                    fileCount: files.length,
                    totalSize,
                    totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
                };
            }

            return stats;
        } catch (error) {
            console.error("[FileService] Failed to get storage stats:", error);
            return null;
        }
    }
}

export const fileService = new FileService();
export default fileService;
