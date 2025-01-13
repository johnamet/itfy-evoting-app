#!/usr/bin/node

/**
 * EventController handles event-related operations.
 * It includes methods for creating, updating, deleting, and listing events, as well as retrieving event details.
 */

import Event from "../models/event.js";
import { ObjectId } from "mongodb";

class EventController {
    /**
     * Creates a new event.
     * @param {Request} req - The request object containing event details.
     * @param {Response} res - The response object.
     */
    static async createEvent(req, res) {
        try {
            const data = req.body;

            if (!data) {
                return res.status(400).send({
                    error: "Missing data",
                    success: false
                });
            }

            console.log(data);

            const { name, description, start_date, end_date } = data;

            if (!name || !description || !start_date || !end_date) {
                return res.status(400).send({
                    success: false,
                    error: "Missing required fields: `name`, `description`, `start_date`, or `end_date`."
                });
            }

            const existingEvent = await Event.get({ name });

            if (existingEvent) {
                return res.status(400).send({
                    error: `Event with name '${name}' already exists.`,
                    success: false
                });
            }

            delete data.name;
            delete data.description;
            delete data.start_date;
            delete data.end_date;

            const event = new Event(name, description, new Date(start_date), new Date(end_date), data);
            const result = await event.save();

            if (!result) {
                return res.status(500).send({
                    success: false,
                    error: "Failed to create event."
                });
            }

            return res.status(201).send({
                success: true,
                event: event.to_object()
            });
        } catch (error) {
            console.error("Error creating event:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Updates an existing event.
     * @param {Request} req - The request object containing event ID and update details.
     * @param {Response} res - The response object.
     */
    static async updateEvent(req, res) {
        try {
            const { eventId } = req.params;
            const body = req.body;

            if (!eventId) {
                return res.status(400).send({
                    success: false,
                    error: "Missing required parameter: `eventId`."
                });
            }

            if (!body) {
                return res.status(400).send({
                    success: false,
                    error: "Missing request body."
                });
            }

            let event = await Event.get({ id: new ObjectId(eventId) });
            if (!event) {
                return res.status(404).send({
                    success: false,
                    error: `Event with ID ${eventId} not found.`
                });
            }

            event = Event.from_object(event);
            const result = await event.updateInstance(body);

            if (!result) {
                return res.status(500).send({
                    success: false,
                    error: "Failed to update event."
                });
            }

            return res.status(200).send({
                success: true,
                event: event.to_object()
            });
        } catch (error) {
            console.error("Error updating event:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Deletes an event.
     * @param {Request} req - The request object containing event ID.
     * @param {Response} res - The response object.
     */
    static async deleteEvent(req, res) {
        try {
            const { eventId } = req.params;

            if (!eventId) {
                return res.status(400).send({
                    success: false,
                    error: "Missing required parameter: `eventId`."
                });
            }

            const result = await Event.delete({ id: new ObjectId(eventId) });

            if (!result) {
                return res.status(404).send({
                    success: false,
                    error: `Event with ID ${eventId} not found or could not be deleted.`
                });
            }

            return res.status(200).send({
                success: true,
                message: `Event with ID ${eventId} successfully deleted.`
            });
        } catch (error) {
            console.error("Error deleting event:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Lists all events or events matching query parameters.
     * @param {Request} req - The request object containing query parameters.
     * @param {Response} res - The response object.
     */
    static async listEvents(req, res) {
        try {
            const query = req.query || {};
            const events = await Event.all(query);

            if ((!events || events.length === 0) && Object.keys(query).length > 0) {
                return res.status(200).send({
                    success: true,
                    error: "No events found matching the given criteria."
                });
            }

            if (!events || events.length === 0) {
                return res.status(200).send({
                    success: true,
                    error: "No events found."
                });
            }



            return res.status(200).send({
                success: true,
                events: events.map(event => Event.from_object(event).to_object())
            });
        } catch (error) {
            console.error("Error listing events:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Retrieves the details of a specific event.
     * @param {Request} req - The request object containing event ID.
     * @param {Response} res - The response object.
     */
    static async getEventDetails(req, res) {
        try {
            const { eventId } = req.params;

            const event = await Event.get({ id: new ObjectId(eventId) });

            if (!event) {
                return res.status(404).send({
                    success: false,
                    error: `Event with ID ${eventId} not found.`
                });
            }

            return res.status(200).send({
                success: true,
                event: Event.from_object(event).to_object()
            });
        } catch (error) {
            console.error("Error retrieving event details:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }
}

export default EventController;
