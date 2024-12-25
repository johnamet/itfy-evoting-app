/**
 * Role
 * 
 * A class representing a role in the system. This class extends the Basemodel
 * and provides a structure for role-related data and operations.
 */

import Basemodel from "./basemodel.js";

class Role extends Basemodel {
    // Name of the MongoDB collection associated with this model
    collection = "roles";

    /**
     * Constructs a new Role instance.
     * 
     * @param {string} name - The name of the role (e.g., "Admin", "User").
     * @param {string} description - A brief description of the role.
     * @param {...object} kwargs - Additional fields to dynamically add to the role.
     */
    constructor(name, description, ...kwargs) {
        super(kwargs); // Call the Basemodel constructor with additional fields
        this.name = name; // Assign the role name
        this.description = description; // Assign the role description
    }
}

export default Role;
