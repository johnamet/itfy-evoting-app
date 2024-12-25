/**
 * Category
 *
 * A class representing a category for nominees (e.g., "Best Programmer").
 * This class extends the Basemodel and provides a structure for managing
 * category-related data.
 */

import Basemodel from "./basemodel.js";

class Category extends Basemodel {
    // Name of the MongoDB collection associated with this model
    static collection = "categories";

    /**
     * Constructs a new Category instance.
     *
     * @param {string} name - The name of the category (e.g., "Best Designer").
     * @param {string} description - A brief description of the category.
     * @param {string} thumbnailUri - The URI of the category's thumbnail image.
     * @param {string} eventId - The ID of the event this category is associated with.
     * @param {...object} kwargs - Additional fields to dynamically add to the category instance.
     */
    constructor(name, description, thumbnailUri, eventId, ...kwargs) {
        super(kwargs); // Call the Basemodel constructor with additional fields

        this.name = name; // Assign the category name
        this.description = description; // Assign the category description
        this.thumbnailUri = thumbnailUri; // Assign the thumbnail URI
        this.eventId = eventId; // Assign the associated event ID
    }
}

export default Category;
