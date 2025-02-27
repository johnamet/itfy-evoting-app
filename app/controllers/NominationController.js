#!/usr/bin/node

/**
 * NominationController handles nomination-related operations.
 * It includes methods for creating, updating, deleting, and listing nominations, as well as retrieving nomination details.
 */

import Nomination from "../models/nomination.js";
import Event from "../models/event.js";
import Category from "../models/category.js";
import Candidate from "../models/candidate.js";
import { NominationForm } from "../models/nomination.js";
import { ObjectId } from "mongodb";

class NominationController {
    /**
     * Creates a new nomination.
     * @param {Request} req - The request object containing nomination details.
     * @param {Response} res - The response object.
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

            const { candidate_email, event_id, category_id } = data;

            if (!candidate_email || !event_id || !category_id) {
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

            const candidate = await Candidate.get({ email: candidate_email });
            if (!candidate) {
                return res.status(404).send({
                    success: false,
                    error: `Candidate with email ${candidate_email} not found.`
                });
            }

            // Check for duplicate nomination
            const existingNomination = await Nomination.get({
                candidate_id: candidate.id,
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
            const nomination = new Nomination(candidate.id, event_id, category_id, data);
            const result = await nomination.save();

            const candidateInstance = Candidate.from_object(candidate);

            const categories = candidateInstance.category_ids;

            categories.push(category_id);

            await candidateInstance.updateInstance({ category_ids: categories });

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
     * @param {Request} req - The request object containing query parameters.
     * @param {Response} res - The response object.
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
     * Update an existing nomination.
     * @param {Request} req - The request object containing nomination ID and update details.
     * @param {Response} res - The response object.
     */
    static async updateNomination(req, res) {
        try {
            const { nominationId } = req.params;
            const updates = req.body;

            if (!nominationId) {
                return res.status(400).send({
                    success: false,
                    error: "Missing `nominationId` parameter.",
                });
            }

            if (!updates || Object.keys(updates).length === 0) {
                return res.status(400).send({
                    success: false,
                    error: "No fields to update provided.",
                });
            }

            // Fetch the nomination
            let nomination = await Nomination.get({ id: nominationId });

            if (!nomination) {
                return res.status(404).send({
                    success: false,
                    error: `Nomination with ID ${nominationId} not found.`,
                });
            }

            // Validate updates
            const { candidate_id, event_id, category_id } = updates;

            if (candidate_id) {
                const candidate = await Candidate.get({ id: candidate_id });
                if (!candidate) {
                    return res.status(404).send({
                        success: false,
                        error: `Candidate with ID ${candidate_id} not found.`,
                    });
                }
            }

            if (event_id) {
                const event = await Event.get({ id: event_id });
                if (!event) {
                    return res.status(404).send({
                        success: false,
                        error: `Event with ID ${event_id} not found.`,
                    });
                }
            }

            if (category_id) {
                const category = await Category.get({ id: category_id });
                if (!category) {
                    return res.status(404).send({
                        success: false,
                        error: `Category with ID ${category_id} not found.`,
                    });
                }
            }

            // Update the nomination
            nomination = Nomination.from_object(nomination);
            await nomination.updateInstance(updates);

            return res.status(200).send({
                success: true,
                nomination: nomination.to_object(),
            });
        } catch (error) {
            console.error("Error updating nomination:", error);
            return res.status(500).send({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Retrieves the details of a specific nomination.
     * @param {Request} req - The request object containing nomination ID.
     * @param {Response} res - The response object.
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
     * @param {Request} req - The request object containing nomination ID.
     * @param {Response} res - The response object.
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
     * @param {Request} req - The request object containing query parameters.
     * @param {Response} res - The response object.
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


    /**
     * Create a nomination requirement form
     * @param {Request} req - The request object containing query parameters.
     * @param {Response} res - The response object.
     */
    static async createNominationRequirementForm(req, res) {
        try {
            const { eventId } = req.params;

            console.log(eventId)

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

            const requirements = req.body;

            if (!requirements) {
                return res.status(400).send({
                    success: false,
                    error: "Please provide the requirements for the nomination forms."
                })
            }


            const form = new NominationForm(requirements);
            const result = await form.save()

            const fetchedNom = await NominationForm.all()

            console.log(fetchedNom)
            if (result) {
                return res.status(200).send({
                    success: true,
                    message: "Form created successfully",
                    form
                })
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
     * Retrieve a nomination form based on eventId and categoryId
     * @param {Request} req - The request object containing query parameters.
     * @param {Response} res - The response object.
     */
    static async getNominationForm(req, res) {
        try {
            const { eventId} = req.params;

            if (!eventId) {
                return res.status(400).send({
                    success: false,
                    error: "Provide both eventId",
                });
            }

            const form = await NominationForm.get({
                eventId: eventId,
            });

            if (!form) {
                return res.status(404).send({
                    success: false,
                    error: `Nomination form not found for eventId: ${eventId}.`,
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
export default NominationController;
