/**
 * Candidate
 *
 * A class representing a candidate to be nominated. This class extends the Basemodel
 * and provides a structure for managing candidate-related data in the nomination system.
 */

import { cacheEngine } from "../utils/engine/CacheEngine.js";
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
    constructor(name, event_id, category_ids = [], ...kwargs) {
        super(kwargs); // Call the Basemodel constructor with additional fields

        this.name = name; // Assign the candidate's name
        this.event_id = event_id; // Assign the event ID
        this.category_ids = category_ids; // Assign the list of category IDs
    }

    /**
     * Factory method to create a new Candidate instance.
     *
     * @param {string} name - The name of the candidate.
     * @param {string} event_id - The ID of the associated event.
     * @param {Array<string>} category_ids - The IDs of the associated categories.
     * @param {object} kwargs - Additional fields to dynamically add to the instance.
     * @returns {Candidate} - A new Candidate instance.
     */
    static async create(name, event_id, category_ids = [], kwargs = {}) {
        const voting_id = await this.generateUniqueCode(name); // Generate and add unique voting ID
        return new this(name, event_id, category_ids, {voting_id, ...kwargs}); // Create and return the new instance
    }

    /**
     * Generates a unique voting ID for the candidate based on their name.
     *
     * @param {string} candidateName - The name of the candidate.
     * @returns {string} - A unique voting ID.
     */
    static async generateUniqueCode(candidateName) {
        // Ensure the candidate's name is at least two characters long
        if (candidateName.length < 2) {
            throw new Error("Candidate's name must be at least two characters long");
        }

        // Get the first two letters of the candidate's name
        const namePart = candidateName.substring(0, 2).toUpperCase();

        // Calculate the sum of ASCII values of the candidate's name
        const asciiSum = candidateName.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);

        // Get the first three digits of the ASCII sum
        const asciiPart = asciiSum.toString().substring(0, 3);

        // Generate three random digits
        const randomPart = Math.floor(100 + Math.random() * 900); // Generates a number between 100 and 999

        // Combine the name part, ASCII part, and the random part to form the unique code
        const uniqueCode = `${namePart}${asciiPart}${randomPart}`;

        // Check if the code has been generated earlier
        const exists = await cacheEngine.get(uniqueCode);

        if (exists) {
            // Retry with a reversed name
            return this.generateUniqueCode(candidateName.split("").reverse().join(""));
        }

        // Store the unique code in the cache
        await cacheEngine.set(uniqueCode, uniqueCode);

        return uniqueCode;
    }
}

export default Candidate;
