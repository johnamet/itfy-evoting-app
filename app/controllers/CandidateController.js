#!/usr/bin/node

/**
 * CandidateController handles candidate-related operations.
 * It includes methods for creating, updating, deleting, and listing candidates, as well as handling bulk uploads.
 */

import Candidate from "../models/candidate.js";
import Event from "../models/event.js";
import Category from "../models/category.js";
import { ObjectId } from "mongodb";
import { parse } from "csv-parse";
import fs from "fs";

const uploadProgress = new Map(); // To track ongoing uploads and their progress

class CandidateController {
    /**
     * Creates a new candidate.
     * @param {Request} req - The request object containing candidate details.
     * @param {Response} res - The response object.
     */
    static async createCandidate(req, res) {
        try {
            const data = req.body;

            if (!data) {
                return res.status(400).send({
                    success: false,
                    error: "Missing data."
                });
            }

            const { name, event_id, category_ids } = data;

            if (!name || !event_id) {
                return res.status(400).send({
                    success: false,
                    error: "Missing required fields: `name`, `event_id`."
                });
            }

            // Validate event existence
            const event = await Event.get({ id: new ObjectId(event_id) });
            if (!event) {
                return res.status(404).send({
                    success: false,
                    error: `Event with ID ${event_id} not found.`
                });
            }

            // Validate categories
            if (category_ids){
                for (const categoryId of category_ids) {
                const category = await Category.get({ id: new ObjectId(categoryId) });
                if (!category) {
                    return res.status(404).send({
                        success: false,
                        error: `Category with ID ${categoryId} not found.`
                    });
                }
            }
            }
            

            //check if candidate with name exists
            const existingCandidate = await Candidate.get({name: name});

            if (existingCandidate){
                res.status(400).send({
                    success: false,
                    error: `Candidate with name ${name} exists.`
                });
            }
            // Create candidate
            const candidate = await Candidate.create(name, event_id, category_ids ? category_ids: []);
            const result = await candidate.save();

            if (!result) {
                return res.status(500).send({
                    success: false,
                    error: "Failed to create candidate."
                });
            }

            return res.status(201).send({
                success: true,
                candidate: candidate.to_object()
            });
        } catch (error) {
            console.error("Error creating candidate:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Handles bulk upload of candidates via CSV or Excel file.
     * @param {Request} req - The request object containing the file.
     * @param {Response} res - The response object.
     */
    static async bulkUploadCandidates(req, res) {
        try {
            if (!req.file) {
                return res.status(400).send({
                    success: false,
                    error: "No file uploaded."
                });
            }

            const filePath = req.file.path;
            const rows = [];

            const parser = fs
                .createReadStream(filePath)
                .pipe(
                    parse({
                        columns: true,
                        skip_empty_lines: true
                    })
                );

            for await (const row of parser) {
                rows.push(row);
            }

            // Validate headers
            const requiredColumns = ["name", "event_id", "category_ids"];
            const fileColumns = Object.keys(rows[0]);
            const missingColumns = requiredColumns.filter(
                column => !fileColumns.includes(column)
            );

            if (missingColumns.length > 0) {
                return res.status(400).send({
                    success: false,
                    error: `Missing required columns: ${missingColumns.join(", ")}.`
                });
            }

            const uploadId = new ObjectId().toString();
            uploadProgress.set(uploadId, { total: rows.length, processed: 0 });

            // Process rows with a worker-like approach
            const processRow = async row => {
                try {
                    const { name, event_id, category_ids } = row;

                    // Validate event
                    const event = await Event.get({ id: new ObjectId(event_id) });
                    if (!event) {
                        console.error(`Event with ID ${event_id} not found.`);
                        return;
                    }

                    // Validate categories
                    const categoryIdList = category_ids.split(",");
                    for (const categoryId of categoryIdList) {
                        const category = await Category.get({ id: new ObjectId(categoryId.trim()) });
                        if (!category) {
                            console.error(`Category with ID ${categoryId} not found.`);
                            return;
                        }
                    }

                    // Create and save candidate
                    const candidate = await Candidate.create(name, event_id, categoryIdList);
                    await candidate.save();
                } catch (error) {
                    console.error("Error processing row:", row, error);
                } finally {
                    const progress = uploadProgress.get(uploadId);
                    if (progress) {
                        progress.processed += 1;
                    }
                }
            };

            for (const row of rows) {
                await processRow(row);
            }

            uploadProgress.delete(uploadId);

            return res.status(200).send({
                success: true,
                message: "Bulk upload initiated. Candidates are being processed.",
                uploadId
            });
        } catch (error) {
            console.error("Error in bulk upload:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Lists ongoing uploads.
     * @param {Request} req - The request object.
     * @param {Response} res - The response object.
     */
    static listOngoingUploads(req, res) {
        const uploads = Array.from(uploadProgress.entries()).map(([id, progress]) => ({
            uploadId: id,
            total: progress.total,
            processed: progress.processed
        }));

        return res.status(200).send({
            success: true,
            uploads
        });
    }

    /**
     * Checks the progress of a specific upload.
     * @param {Request} req - The request object containing upload ID.
     * @param {Response} res - The response object.
     */
    static checkUploadProgress(req, res) {
        const { uploadId } = req.params;
        const progress = uploadProgress.get(uploadId);

        if (!progress) {
            return res.status(404).send({
                success: false,
                error: "Upload not found or already completed."
            });
        }

        return res.status(200).send({
            success: true,
            progress
        });
    }

    /**
     * Lists candidates with optional filters.
     * @param {Request} req - The request object containing query parameters.
     * @param {Response} res - The response object.
     */
    static async listCandidates(req, res) {
        try {
            const query = req.query || {};
            const candidates = await Candidate.all(query);

            if (!candidates || candidates.length === 0) {
                return res.status(404).send({
                    success: false,
                    error: "No candidates found matching the given criteria."
                });
            }

            return res.status(200).send({
                success: true,
                candidates: candidates.map(candidate => Candidate.from_object(candidate).to_object())
            });
        } catch (error) {
            console.error("Error listing candidates:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Updates an existing candidate.
     * @param {Request} req - The request object containing candidate ID and update details.
     * @param {Response} res - The response object.
     */
    static async updateCandidate(req, res) {
        try {
            const { candidateId } = req.params;
            const updates = req.body;

            if (!candidateId) {
                return res.status(400).send({
                    success: false,
                    error: "Missing `candidateId` parameter.",
                });
            }

            if (!updates || Object.keys(updates).length === 0) {
                return res.status(400).send({
                    success: false,
                    error: "Missing fields to update.",
                });
            }

            // Fetch the candidate to update
            let candidate = await Candidate.get({ id: new ObjectId(candidateId) });
            if (!candidate) {
                return res.status(404).send({
                    success: false,
                    error: `Candidate with ID ${candidateId} not found.`,
                });
            }

            candidate = Candidate.from_object(candidate);

            // Validate event if updated
            if (updates.event_id) {
                const event = await Event.get({ id: new ObjectId(updates.event_id) });
                if (!event) {
                    return res.status(404).send({
                        success: false,
                        error: `Event with ID ${updates.event_id} not found.`,
                    });
                }
            }

            // Validate categories if updated
            if (updates.category_ids) {
                for (const categoryId of updates.category_ids) {
                    const category = await Category.get({ id: new ObjectId(categoryId) });
                    if (!category) {
                        return res.status(404).send({
                            success: false,
                            error: `Category with ID ${categoryId} not found.`,
                        });
                    }
                }
            }

            // Update the candidate
            await candidate.updateInstance(updates);

            return res.status(200).send({
                success: true,
                candidate: candidate.to_object(),
            });
        } catch (error) {
            console.error("Error updating candidate:", error);
            return res.status(500).send({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Deletes an existing candidate.
     * @param {Request} req - The request object containing candidate ID.
     * @param {Response} res - The response object.
     */
    static async deleteCandidate(req, res) {
        try {
            const { candidateId } = req.params;

            if (!candidateId) {
                return res.status(400).send({
                    success: false,
                    error: "Missing `candidateId` parameter.",
                });
            }

            const candidate = await Candidate.get({ id: new ObjectId(candidateId) });
            if (!candidate) {
                return res.status(404).send({
                    success: false,
                    error: `Candidate with ID ${candidateId} not found.`,
                });
            }

            // Delete the candidate
            const deleteResult = await Candidate.delete({ id: new ObjectId(candidateId) });

            if (!deleteResult) {
                return res.status(500).send({
                    success: false,
                    error: "Failed to delete candidate.",
                });
            }

            return res.status(200).send({
                success: true,
                message: `Candidate with ID ${candidateId} successfully deleted.`,
            });
        } catch (error) {
            console.error("Error deleting candidate:", error);
            return res.status(500).send({
                success: false,
                error: error.message,
            });
        }
    }
}

export default CandidateController;
