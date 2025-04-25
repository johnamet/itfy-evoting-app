#!/usr/bin/node

/**
 * CandidateController handles candidate-related operations.
 * It includes methods for creating, updating, deleting, and listing candidates, as well as handling bulk uploads.
 */

import Candidate, { CandidateForm } from "../models/candidate.js";
import Event from "../models/event.js";
import Category from "../models/category.js";
import { ObjectId } from "mongodb";
import { parse } from "csv-parse";
import fs from "fs";
import Activity from "../models/activity.js";
import jobQueue  from "../utils/engine/JobEngine.js";

const uploadProgress = new Map(); // To track ongoing uploads and their progress

class CandidateController {

    /**
     * Creates a candidate for open events
     * * @param {Request} req - The request object containing candidate details.
     * * @param {Response} res - The response object.
     * 
     */
    static async registerCandidate(req, res) {
        try{
            const data= req.body;

            if (!data){
                return res.status(400).send({
                    success: false,
                    error: "Missing data."
                });
            }

            const { name, event_id, category_ids } = data;

            if (!name || !event_id){
                return res.status(400).send({
                    success: false,
                    error: "Missing required fields: `name`, `event_id`."
                });
            }

            // Validate event existence
            const event = await Event.get({ id: new ObjectId(event_id) });

            //check the event is an open event
            const eventType = event.type;
            if (!event || eventType !== "open"){
                return res.status(404).send({
                    success: false,
                    error: `Event with ID ${event_id} not found or not an open event.`
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
                return res.status(400).send({
                    success: false,
                    error: `Candidate with name ${name} exists.`
                });
            }

            // check if candidate with email exists
            const email = data.email;
            if (email){
                const existingEmailCandidate = await Candidate.get({email: email});
                if (existingEmailCandidate){
                    return res.status(400).send({
                        success: false,
                        error: `Candidate with email ${email} exists.`
                    });
                }
            }

            delete data.category_ids;
            delete data.event_id;
            delete data.name;

            //create candidate
            const candidate = new Candidate(name, event_id, category_ids ? category_ids: [], data);
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
        }catch (error) {
            console.error("Error creating candidate:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }
    /**
     * Creates a new candidate.
     * @param {Request} req - The request object containing candidate details.
     * @param {Response} res - The response object.
     */
    static async createCandidate(req, res) {
        let activity = null

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
                return res.status(400).send({
                    success: false,
                    error: `Candidate with name ${name} exists.`
                });
            }

            delete data.category_ids;
            delete data.name;
            delete data.event_id;
            // Create candidate
            const voting_id = Candidate.generateUniqueCode(name);
            data.voting_id = voting_id;

            const candidate = new Candidate(name, event_id, category_ids ? category_ids: [], data);
            const result = await candidate.save();
            if (!result) {
                activity = new Activity(req.user.id, 'create', 'candidate', candidate.id, new Date(), ...{success: false});
                return res.status(500).send({
                    success: false,
                    error: "Failed to create candidate."
                });
            }

             activity = new Activity(req.user.id, 'create', 'candidate', candidate.id, new Date(), {success: true});
            jobQueue.add('activity', activity.save());

            return res.status(201).send({
                success: true,
                candidate: candidate.to_object()
            });
        } catch (error) {
            activity = new Activity(req.user.id, 'create', 'candidate', null, new Date(), {success: false});
            jobQueue.add('activity', activity.save());
            console.error("Error creating candidate:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }
    /**
     * Retrieves a single candidate from the server
     * @param {Request} req - The request object containing candidate ID.
     * @param {Response} res - The response object.
     */
    static async getCandidate(req, res) {
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

            return res.status(200).send({
                success: true,
                candidate: Candidate.from_object(candidate).to_object(),
            });
        } catch (error) {
            console.error("Error retrieving candidate:", error);
            return res.status(500).send({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Handles bulk upload of candidates via CSV or Excel file.
     * @param {Request} req - The request object containing the file.
     * @param {Response} res - The response object.
     */
    static async bulkUploadCandidates(req, res) {
        let activity = null;
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

            activity = new Activity(req.user.id, 'bulk_upload', 'candidate', null, new Date(), {success: true});
            jobQueue.add('activity', activity.save());
            return res.status(200).send({
                success: true,
                message: "Bulk upload initiated. Candidates are being processed.",
                uploadId
            });
        } catch (error) {
            activity = new Activity(req.user.id, 'bulk_upload', 'candidate', null, new Date(), {success: false});
            jobQueue.add('activity', activity.save());
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
     * Lists candidates with optional filters and pagination.
     * @param {Request} req - The request object containing query parameters.
     * @param {Response} res - The response object.
     */
    static async listCandidates(req, res) {
        try {
            const query = req.query || {};
            const page = parseInt(query.page, 10) || 1;
            const limit = parseInt(query.limit, 10) || 10;
            const skip = (page - 1) * limit;

            delete query.page;
            delete query.limit;

            console.log(query);

            Object.keys(query).forEach(key => {
                if (key === "id") { 
                    query[key] = new ObjectId(query[key]);
                }
            });

            if (query.category_ids) {
                query.category_ids = { $in: query.category_ids.split(',').map(id => id.trim()) };
            }

            console.log(query);

            const candidates = await Candidate.all(query, { skip, limit });

            if (!candidates || candidates.length === 0) {
                return res.status(200).send({
                    success: true,
                    error: "No candidates found matching the given criteria.",
                    candidates: []
                });
            }

            const totalCandidates = await Candidate.count(query);
            const totalPages = Math.ceil(totalCandidates / limit);

            return res.status(200).send({
                success: true,
                candidates: candidates.map(candidate => Candidate.from_object(candidate).to_object()),
                pagination: {
                    totalCandidates,
                    totalPages,
                    currentPage: page,
                    pageSize: limit
                }
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
        let activity = null;
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

            await candidate.updateInstance(updates);

            // Update the candidate
            if (updates.status) {
                // If the status is updated to "approved", generate a reference code
                if (updates.status === "approved"){
                    const referenceCode = await Candidate.generateReferenceCode(candidate.name, candidate.event_id);
                    console.log(referenceCode)
                    await candidate.updateInstance({reference_code: referenceCode});
                    //Todo: Send email of approval
                }else{
                   //Todo: Send email of rejection
                }
            }

            activity = new Activity(req.user.id, 'update', 'candidate', candidate.id, new Date(), {success: true});
            jobQueue.add('activity', activity.save());

            return res.status(200).send({
                success: true,
                candidate: candidate.to_object(),
            });
        } catch (error) {
            activity = new Activity(req.user.id, 'update', 'candidate', null, new Date(), {success: false});
            jobQueue.add('activity', activity.save());
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
        let activity = null;
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

            activity = new Activity(req.user.id, 'delete', 'candidate', candidateId, new Date(), {success: true});
            jobQueue.add('activity', activity.save());
            return res.status(200).send({
                success: true,
                message: `Candidate with ID ${candidateId} successfully deleted.`,
            });
        } catch (error) {
            activity = new Activity(req.user.id, 'delete', 'candidate', null, new Date(), {success: false});
            jobQueue.add('activity', activity.save());
            console.error("Error deleting candidate:", error);
            return res.status(500).send({
                success: false,
                error: error.message,
            });
        }
    }

     /**
         * Create a candidate requirement form
         * @param {Request} req - The request object containing query parameters.
         * @param {Response} res - The response object.
         */
        static async createCandidateRequirementForm(req, res) {
            try {
                const { eventId } = req.params;

    
                let result = null;
    
                if (!eventId) {
                    return res.status(400).send({
                        success: false,
                        error: "Provide the event id"
                    });
                }
    
                const event = await Event.get({ id: new ObjectId(eventId) })
    
                if (!event) {
                    console.log(`Event with id: ${eventId} not found.`)
                    return res.status(404).send({
                        success: false,
                        error: `Event with id: ${eventId} not found.`
                    })
                }

                if (event.type !== "open"){
                    return res.status(400).send({
                        success: false,
                        error: "Event type should be open"
                    })
                }
    
                const requirements = req.body;
    
                if (!requirements) {
                    return res.status(400).send({
                        success: false,
                        error: "Please provide the requirements for the nomination forms."
                    })
                }
    
                let form = null;
                form = await CandidateForm.get({ event_id: eventId })
                if (form) {
                    form = CandidateForm.from_object(form)
                    await form.updateInstance(requirements)
                    return res.status(201).send({
                        success: true,
                        message: "Form updated successfully",
                        form: await CandidateForm.get({ eventId: eventId })
                    })
                } else {
                    form = new CandidateForm(requirements);
                    result = await form.save()
                    if (result) {
                        return res.status(200).send({
                            success: true,
                            message: "Form created successfully",
                            form
                        })
                    }
                }
    
            } catch (e) {
                console.error(`Error creating the form ${e}`)
                return res.status(500).send(
                    {
                        success: false,
                        error: `Failed to create form due to Internal Error, Error: ${e}`
                    }
                )
            }
        }
    
        /**
         * Retrieve a candidate form based on eventId and categoryId
         * @param {Request} req - The request object containing query parameters.
         * @param {Response} res - The response object.
         */
        static async getCandidateRequirementForm(req, res) {
            try {
                const { eventId } = req.params;
    
                if (!eventId) {
                    return res.status(400).send({
                        success: false,
                        error: "Provide both eventId",
                    });
                }
    
                const form = await CandidateForm.get({
                    event_id: eventId,
                });
    
                if (!form) {
                    return res.status(404).send({
                        success: false,
                        error: `Candidate Registration form not found for eventId: ${eventId}.`,
                    });
                }
    
                return res.status(200).send({
                    success: true,
                    form,
                });
    
            } catch (e) {
                console.error(`Error retrieving the nomination form: ${e}`);
                return res.status(500).send({
                    success: false,
                    error: `Failed to retrieve form due to Internal Error, Error: ${e}`,
                });
            }
        }
}

export default CandidateController;
