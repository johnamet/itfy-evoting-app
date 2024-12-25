/**
 * The user class
 * Extends the Basemodel to provide functionality for user management.
 */

import Basemodel from "./basemodel.js";
import bcrypt from "bcrypt"; // Import bcrypt for password hashing

class User extends Basemodel {

    collection = "users";
    /**
     * Constructor to initialize a new User instance.
     *
     * @param {string} name - The name of the user.
     * @param {string} email - The email address of the user.
     * @param {string} password - The raw password of the user (will be hashed).
     * @param {...object} kwargs - Additional fields to pass to the base model.
     */
    constructor(name, email, password, kwargs = {}) {
        super(kwargs); // Initialize base model fields
        this.name = name;
        this.email = email;
        this.setPassword(password); // Hash and set the password
    }

    /**
     * Hashes and sets the user's password.
     *
     * @param {string} password - The raw password to hash and store.
     */
    async setPassword(password) {
        const saltRounds = 10;
        this.password = await bcrypt.hash(password, saltRounds);
    }

    /**
     * Verifies if a provided password matches the stored hashed password.
     *
     * @param {string} password - The raw password to verify.
     * @returns {Promise<boolean>} - Returns true if passwords match, false otherwise.
     */
    async verifyPassword(password) {
        return bcrypt.compare(password, this.password);
    }

    /**
     * Converts the User instance to a plain JavaScript object,
     * excluding sensitive fields like the password.
     *
     * @returns {object} - The user object without sensitive information.
     */
    to_object() {
        const obj = super.to_object(); // Get base model fields
        obj.name = this.name;
        obj.email = this.email;
        delete obj.password; // Exclude password from the output
        return obj;
    }
}

export default User;
