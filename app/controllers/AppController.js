#!/usr/bin/node

/**
 * AppController handles application-wide operations.
 * It includes methods for file uploads, retrieving application status, and statistics.
 */

import Candidate from "../models/candidate.js";
import Category from "../models/category.js";
import Nomination from "../models/nomination.js";
import Role from "../models/role.js";
import Vote from "../models/vote.js";
import Event from "../models/event.js";
import User from "../models/user.js";
import storage from "../utils/engine/StorageEngine.js";
import { cacheEngine } from "../utils/engine/CacheEngine.js";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";

// Configure multer for file uploads
const uploadStorage = multer.memoryStorage();
const upload = multer({ uploadStorage });

class AppController {

    static fileStoragePath = "./uploads"; // Define the base directory for file storage

    /**
     * Initialize the file storage directory.
     */
    static initializeStorage() {
        if (!fs.existsSync(AppController.fileStoragePath)) {
            fs.mkdirSync(AppController.fileStoragePath, { recursive: true });
        }
    }

    /**
     * Upload a file and associate it with a specific entity.
     * @param {Request} req - The request object containing the file and metadata.
     * @param {Response} res - The response object.
     * @returns {Promise<Response>} - The response with file details.
     */
    static async uploadFile(req, res) {
        upload.single('file')(req, res, async (err) => {
            if (err) {
		    console.log(err);
                return res.status(500).send({ success: false, error: "Failed to upload file." });
            }

            try {
                const { category, entityId } = req.body;

                if (!req.file) {
                    return res.status(400).send({ success: false, error: "No file uploaded." });
                }

                if (!category || !entityId) {
                    return res.status(400).send({
                        success: false,
                        error: "Missing required fields: `category` or `entityId`.",
                    });
                }

                const entityPath = path.join(AppController.fileStoragePath, category, entityId);
                if (!fs.existsSync(entityPath)) {
                    fs.mkdirSync(entityPath, { recursive: true });
                }else{
			// Delete all files in the directory
    fs.readdirSync(entityPath).forEach((file) => {
        const filePath = path.join(entityPath, file);
        if (fs.lstatSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
        }
    });
		}

                const fileName = `${entityId}_${req.file.originalname}`;
                const filePath = path.join(entityPath, fileName);

                fs.writeFileSync(filePath, req.file.buffer);

                return res.status(201).send({
                    success: true,
                    message: "File uploaded successfully.",
                    file: {
                        name: fileName,
                        path: filePath,
                        category,
                        entityId,
                    },
                });
            } catch (error) {
                console.error("Error uploading file:", error);
                return res.status(500).send({ success: false, error: "Failed to upload file." });
            }
        });
    }

    /**
     * Retrieve files associated with a specific entity and category.
     * @param {Request} req - The request object containing the category and entityId.
     * @param {Response} res - The response object.
     * @returns {Promise<Response>} - The response with a list of files or the specific file content.
     */
    static async getFiles(req, res) {
        try {
            const { categoryId, entityId } = req.params;

            if (!categoryId || !entityId) {
                return res.status(400).send({
                    success: false,
                    error: "Missing required fields: `category` or `entityId`.",
                });
            }

            const entityPath = path.join(AppController.fileStoragePath, categoryId, entityId);

            if (!fs.existsSync(entityPath)) {
                return res.status(404).send({
                    success: false,
                    error: `No files found for category: ${categoryId} and entityId: ${entityId}.`,
                });
            }

            const files = fs.readdirSync(entityPath).map((file) => ({
                name: file,
                path: path.join(entityPath, file),
            }));

            return res.status(200).send({ success: true, files });
        } catch (error) {
            console.error("Error retrieving files:", error);
            return res.status(500).send({ success: false, error: "Failed to retrieve files." });
        }
    }
/**
 * Open a specific file and return it for viewing or downloading.
 * @param {Request} req - The request object containing the categoryId, entityId, and fileName.
 * @param {Response} res - The response object.
 * @returns {Promise<Response>} - The file content for viewing or download.
 */
static async openFile(req, res) {
    try {
        const { categoryId, entityId, fileName } = req.params;

        // Validate required parameters
        if (!categoryId || !entityId || !fileName) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields: `categoryId`, `entityId`, or `fileName`.",
            });
        }

        // Construct and sanitize file path
        const filePath = path.resolve(
            AppController.fileStoragePath,
            categoryId,
            entityId,
            fileName
        );

        // Check if the file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: "File not found.",
            });
        }

        // Send the file for viewing
        return res.sendFile(filePath, (err) => {
            if (err) {
                console.error("Error sending file:", err);
                return res.status(500).json({
                    success: false,
                    error: "Failed to send the file.",
                });
            }
        });
    } catch (error) {
        console.error("Error opening file:", error);
        return res.status(500).json({
            success: false,
            error: "An unexpected error occurred while opening the file.",
        });
    }
}


    /**
     * Download a specific file.
     * @param {Request} req - The request object containing the category, entityId, and fileName.
     * @param {Response} res - The response object.
     * @returns {Promise<Response>} - The file content as a download.
     */
    static async downloadFile(req, res) {
        try {
            const { categoryId, entityId, fileName } = req.params;

            if (!categoryId || !entityId || !fileName) {
                return res.status(400).send({
                    success: false,
                    error: "Missing required fields: `categoryId`, `entityId`, or `fileName`.",
                });
            }

            const filePath = path.join(
                AppController.fileStoragePath,
                categoryId,
                entityId,
                fileName
            );

            if (!fs.existsSync(filePath)) {
                return res.status(404).send({
                    success: false,
                    error: "File not found.",
                });
            }

            return res.download(filePath);
        } catch (error) {
            console.error("Error downloading file:", error);
            return res.status(500).send({ success: false, error: "Failed to download file." });
        }
    }
    /**
     * Retrieve the status of the application, including database connection, latency, uptime, and load time.
     * @param {Request} req - The request object.
     * @param {Response} res - The response object.
     * @returns {Promise<Response>} - The status of the application.
     */
    static async getStatus(req, res) {
        try {
            const status = {
                connection: "Ok",
                db: {
                    connection: await storage.isConnected(),
                    latency: await storage.getLatency(),
                },
                cache: {
                    connection: cacheEngine.isConnected(),
                    latency: await cacheEngine.getLatency()
                },
                uptime: process.uptime(),
                loadTime: process.hrtime()
            };

            return res.status(200).send(status);
        } catch (error) {
            console.error("Error retrieving application status:", error);
            return res.status(500).send({ error: "Failed to retrieve application status." });
        }
    }

    /**
     * Retrieve statistics for various entities in the application.
     * @param {Request} req - The request object.
     * @param {Response} res - The response object.
     * @returns {Promise<Response>} - The statistics for the entities.
     */
    static async getStats(req, res) {
        try {
            const count = {
                candidates: await Candidate.count(),
                categories: await Category.count(),
                events: await Event.count(),
                nominations: await Nomination.count(),
                roles: await Role.count(),
                users: await User.count(),
                votes: await Vote.count(),
            };

            return res.status(200).send(count);
        } catch (error) {
            console.error("Error retrieving application statistics:", error);
            return res.status(500).send({ error: "Failed to retrieve application statistics." });
        }
    }
}

AppController.initializeStorage();

export default AppController;
