import Nomination from "../models/nomination.js";
import Event from "../models/event.js";
import Category from "../models/category.js";
import Candidate from "../models/candidate.js";
import { ObjectId } from "mongodb";

class NominationController {
    /**
     * Creates a new nomination.
     */
    static async createNomination(req, res) {
        try {
            const data = req.body;

            if (!data) {
                return res.status(400).send({
                    success: false,
                    error: "Missing data."
                });
            }

            const { candidate_id, event_id, category_id } = data;

            if (!candidate_id || !event_id || !category_id) {
                return res.status(400).send({
                    success: false,
                    error: "Missing required fields: `candidate_id`, `event_id`, or `category_id`."
                });
            }

            // Validate related entities
            const event = await Event.get({ id: new ObjectId(event_id) });
            if (!event) {
                return res.status(404).send({
                    success: false,
                    error: `Event with ID ${event_id} not found.`
                });
            }

            const category = await Category.get({ id: new ObjectId(category_id) });
            if (!category) {
                return res.status(404).send({
                    success: false,
                    error: `Category with ID ${category_id} not found.`
                });
            }

            const candidate = await Candidate.get({ id: new ObjectId(candidate_id) });
            if (!candidate) {
                return res.status(404).send({
                    success: false,
                    error: `Candidate with ID ${candidate_id} not found.`
                });
            }

            // Check for duplicate nomination
            const existingNomination = await Nomination.get({
                candidate_id,
                event_id,
                category_id
            });

            if (existingNomination) {
                return res.status(400).send({
                    success: false,
                    error: "Candidate is already nominated in this category for this event."
                });
            }

            // Create nomination
            const nomination = await Nomination.create(candidate_id, event_id, category_id);
            const result = await nomination.save();

            if (!result) {
                return res.status(500).send({
                    success: false,
                    error: "Failed to create nomination."
                });
            }

            return res.status(201).send({
                success: true,
                nomination: nomination.to_object()
            });
        } catch (error) {
            console.error("Error creating nomination:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Lists nominations with optional filters.
     */
    static async listNominations(req, res) {
        try {
            const query = req.query || {};
            const nominations = await Nomination.all(query);

            if (!nominations || nominations.length === 0) {
                return res.status(404).send({
                    success: false,
                    error: "No nominations found matching the given criteria."
                });
            }

            return res.status(200).send({
                success: true,
                nominations: nominations.map(nomination => Nomination.from_object(nomination).to_object())
            });
        } catch (error) {
            console.error("Error listing nominations:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Retrieves the details of a specific nomination.
     */
    static async getNominationDetails(req, res) {
        try {
            const { nominationId } = req.params;

            if (!nominationId) {
                return res.status(400).send({
                    success: false,
                    error: "Missing required parameter: `nominationId`."
                });
            }

            const nomination = await Nomination.get({ id: new ObjectId(nominationId) });

            if (!nomination) {
                return res.status(404).send({
                    success: false,
                    error: `Nomination with ID ${nominationId} not found.`
                });
            }

            return res.status(200).send({
                success: true,
                nomination: Nomination.from_object(nomination).to_object()
            });
        } catch (error) {
            console.error("Error retrieving nomination details:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Deletes a nomination.
     */
    static async deleteNomination(req, res) {
        try {
            const { nominationId } = req.params;

            if (!nominationId) {
                return res.status(400).send({
                    success: false,
                    error: "Missing required parameter: `nominationId`."
                });
            }

            const result = await Nomination.delete({ id: new ObjectId(nominationId) });

            if (!result) {
                return res.status(404).send({
                    success: false,
                    error: `Nomination with ID ${nominationId} not found or could not be deleted.`
                });
            }

            return res.status(200).send({
                success: true,
                message: `Nomination with ID ${nominationId} successfully deleted.`
            });
        } catch (error) {
            console.error("Error deleting nomination:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Counts nominations by event, category, or candidate.
     */
    static async countNominations(req, res) {
        try {
            const query = req.query || {};
            const count = await Nomination.count(query);

            return res.status(200).send({
                success: true,
                count
            });
        } catch (error) {
            console.error("Error counting nominations:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }
}

export default NominationController;
