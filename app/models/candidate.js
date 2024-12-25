/**
 * Candidate
 *
 * A class representing a candidate to be nominated. This class extends the Basemodel
 * and provides a structure for managing candidate-related data in the nomination system.
 */

import Basemodel from "./basemodel.js";

class Candidate extends Basemodel {
    // Name of the MongoDB collection associated with this model
    static collection = "candidates";

    /**
     * Constructs a new Candidate instance.
     *
     * @param {string} name - The name of the candidate to be voted for.
     * @param {string} event_id - The ID of the event the candidate is associated with.
     * @param {Array<string>} category_ids - An array of IDs of the categories the candidate has been nominated for.
     * @param {...object} kwargs - Additional fields to dynamically add to the candidate instance.
     */
    constructor(name, event_id, category_ids, ...kwargs) {
        super(kwargs); // Call the Basemodel constructor with additional fields

        this.name = name; // Assign the candidate's name
        this.event_id = event_id; // Assign the event ID
        this.category_ids = category_ids; // Assign the list of category IDs
        this._collection = "candidates"
    }
}

export default Candidate;
