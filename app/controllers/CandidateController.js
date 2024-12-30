import Candidate from "../models/candidate.js";
import Event from "../models/event.js";
import Category from "../models/category.js";
import Nomination from "../models/nomination.js";
import { ObjectId } from "mongodb";

class CandidateController {
    /**
     * Creates a new candidate.
     */
    static async createCandidate(req, res) {
        try {
            const data = req.body;

            if (!data) {
                return res.status(400).send({
                    success: false,
                    error: "Missing request body."
                });
            }

            const { name, event_id, category_ids } = data;

            if (!name || !event_id || !category_ids || !Array.isArray(category_ids)) {
                return res.status(400).send({
                    success: false,
                    error: "Missing or invalid fields: `name`, `event_id`, or `category_ids`."
                });
            }

            // Validate event
            const event = await Event.get({ id: new ObjectId(event_id) });
            if (!event) {
                return res.status(404).send({
                    success: false,
                    error: `Event with ID ${event_id} not found.`
                });
            }

            // Validate categories
            for (const category_id of category_ids) {
                const category = await Category.get({ id: new ObjectId(category_id), eventId: event_id });
                if (!category) {
                    return res.status(400).send({
                        success: false,
                        error: `Invalid category ID ${category_id} for the given event.`
                    });
                }
            }

            // Check for duplicate candidate in the event
            const existingCandidate = await Candidate.get({ name, event_id });
            if (existingCandidate) {
                return res.status(400).send({
                    success: false,
                    error: `Candidate '${name}' already exists in the event.`
                });
            }

            const candidate = await Candidate.create(name, event_id, category_ids);
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
     * Updates an existing candidate.
     */
    static async updateCandidate(req, res) {
        try {
            const { candidateId } = req.params;
            const body = req.body;

            if (!candidateId) {
                return res.status(400).send({
                    success: false,
                    error: "Missing required parameter: `candidateId`."
                });
            }

            if (!body) {
                return res.status(400).send({
                    success: false,
                    error: "Missing request body."
                });
            }

            let candidate = await Candidate.get({ id: new ObjectId(candidateId) });
            if (!candidate) {
                return res.status(404).send({
                    success: false,
                    error: `Candidate with ID ${candidateId} not found.`
                });
            }

            // Ensure categories are valid if updated
            if (body.category_ids) {
                for (const category_id of body.category_ids) {
                    const category = await Category.get({ id: new ObjectId(category_id), eventId: candidate.event_id });
                    if (!category) {
                        return res.status(400).send({
                            success: false,
                            error: `Invalid category ID ${category_id} for the candidate's event.`
                        });
                    }
                }
            }

            candidate = Candidate.from_object(candidate);
            const result = await candidate.updateInstance(body);

            if (!result) {
                return res.status(500).send({
                    success: false,
                    error: "Failed to update candidate."
                });
            }

            return res.status(200).send({
                success: true,
                candidate: candidate.to_object()
            });
        } catch (error) {
            console.error("Error updating candidate:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Deletes a candidate.
     */
    static async deleteCandidate(req, res) {
        try {
            const { candidateId } = req.params;

            if (!candidateId) {
                return res.status(400).send({
                    success: false,
                    error: "Missing required parameter: `candidateId`."
                });
            }

            // Check if there are active nominations for the candidate
            const activeNominations = await Nomination.get({ candidate_id: candidateId });
            if (activeNominations) {
                return res.status(400).send({
                    success: false,
                    error: "Cannot delete candidate with active nominations."
                });
            }

            const result = await Candidate.delete({ id: new ObjectId(candidateId) });

            if (!result) {
                return res.status(404).send({
                    success: false,
                    error: `Candidate with ID ${candidateId} not found or could not be deleted.`
                });
            }

            return res.status(200).send({
                success: true,
                message: `Candidate with ID ${candidateId} successfully deleted.`
            });
        } catch (error) {
            console.error("Error deleting candidate:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Lists all candidates or candidates matching query parameters.
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
     * Retrieves details of a specific candidate.
     */
    static async getCandidateDetails(req, res) {
        try {
            const { candidateId } = req.params;

            const candidate = await Candidate.get({ id: new ObjectId(candidateId) });

            if (!candidate) {
                return res.status(404).send({
                    success: false,
                    error: `Candidate with ID ${candidateId} not found.`
                });
            }

            return res.status(200).send({
                success: true,
                candidate: Candidate.from_object(candidate).to_object()
            });
        } catch (error) {
            console.error("Error retrieving candidate details:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Counts candidates by event or category.
     */
    static async countCandidates(req, res) {
        try {
            const { event_id, category_id } = req.query;
            const query = {};

            if (event_id) query.event_id = event_id;
            if (category_id) query.category_ids = category_id;

            const count = await Candidate.count(query);

            return res.status(200).send({
                success: true,
                count
            });
        } catch (error) {
            console.error("Error counting candidates:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }
}

export default CandidateController;
