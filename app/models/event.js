/**
 * Event
 *
 * A class representing an event in the system. This class extends the Basemodel
 * and provides a structure for event-related data and operations.
 */

import Basemodel from "./basemodel.js";

class Event extends Basemodel {
    // Name of the MongoDB collection associated with this model
    static collection = "events";

    /**
     * Constructs a new Event instance.
     *
     * @param {string} name - The name of the event (e.g., "CodingFest2024").
     * @param {string} description - A detailed description of the event.
     * @param {Date} startDate - The starting date of the event.
     * @param {Date} endDate - The ending date of the event.
     * @param {...object} kwargs - Additional fields to dynamically add to the event.
     */
    constructor(name, description, startDate, endDate, ...kwargs) {
        super(kwargs); // Call the Basemodel constructor with additional fields

        this.name = name; // Assign the event name
        this.description = description; // Assign the event description
        this.startDate = startDate; // Assign the start date
        this.endDate = endDate; // Assign the end date
    }
}

export default Event;
