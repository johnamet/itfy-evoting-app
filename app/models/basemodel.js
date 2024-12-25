/**
 * The base model for all order models.
 */
import pkg from "mongodb";

const { ObjectId } = pkg;

import StorageEngine from "../utils/engine/StorageEngine.js";

const storage = new StorageEngine();
await storage.connect();

class Basemodel {

    collection = "base";

    constructor(...kwargs) {
        this.id = new ObjectId(); // Generate a new ObjectId
        this.created_at = new Date(); // Set the creation date to the current date
        this.updated_at = new Date(); // Initialize updated_at to the same as created_at

        // Dynamically assign additional fields passed via kwargs
        kwargs.forEach(arg => {
            Object.keys(arg).forEach(key => {
                this[key] = arg[key];
            });
        });
    }

    /**
     * Update the object with new data and set the updated_at timestamp.
     * @param {object} data - The data to update the object with.
     */
    update(data) {
        Object.keys(data).forEach(key => {
            this[key] = data[key];
        });
        this.updated_at = new Date();
    }

    /**
     * Convert the object to a plain JavaScript object.
     * @returns {object} - The plain JavaScript representation of the object.
     */
    to_object() {
        const { id, created_at, updated_at, ...otherFields } = this;
        return {
            id,
            created_at,
            updated_at,
            ...otherFields,
        };
    }

    /**
     * Create an instance of the model from a plain object.
     * @param {object} obj - The plain JavaScript object to populate the model.
     * @returns {Basemodel} - A new Basemodel instance populated with the provided object data.
     */
    static from_object(obj) {
        const instance = new this(); // Create a new instance of the current class
        Object.keys(obj).forEach(key => {
            if (key === "id") {
                instance.id = new ObjectId(obj[key]); // Ensure id is a valid ObjectId
            } else if (key === "created_at" || key === "updated_at") {
                instance[key] = new Date(obj[key]); // Ensure timestamps are valid Date objects
            } else {
                instance[key] = obj[key];
            }
        });
        return instance;
    }

    /**
     * Execute a database operation with error handling.
     * @param {Function} operation - The operation to execute.
     * @returns {Promise<any>} - The result of the operation.
     */
    async execute(operation) {
        try {
            return await operation();
        } catch (e) {
            console.error(`Error executing operation on collection: ${this.collection}`, e);
            throw e;
        }
    }

    /**
     * Save the current instance to the database.
     * @returns {Promise<any>} - The result of the save operation.
     */
    async save() {
        return this.execute(() => {
            return storage.insert(this.collection, this.to_object());
        });
    }

    /**
     * Save multiple instances to the database.
     * @param {Array<Basemodel>} objects - The objects to save.
     * @returns {Promise<any>} - The result of the save operation.
     */
    async saveAll(objects) {
        return this.execute(() => {
            return storage.insertMany(this.collection, objects.map(obj => obj.to_object()));
        });
    }

    /**
     * Update an instance in the database.
     * @param {object} updateObject - The fields to be updated.
     * @returns {Promise<any>} - The result of the update operation.
     */
    async updateInstance(updateObject) {
        return this.execute(() => {
            return storage.update(this.collection, { id: this.id }, updateObject);
        });
    }

    /**
     * Update multiple instances in the database.
     * @param {object} query - The query to find objects to update.
     * @param {object} update - The fields to update.
     * @returns {Promise<any>} - The result of the update operation.
     */
    static async update(query, update) {
        return storage.update(this.prototype.collection, query, update); // Fixed: access the collection via prototype
    }

    /**
     * Delete the current instance from the database.
     * @returns {Promise<any>} - The result of the delete operation.
     */
    async delete() {
        return this.execute(() => {
            return storage.delete(this.collection, { id: this.id });
        });
    }

    /**
     * Delete multiple instances from the database.
     * @param {object} query - The query to find objects to delete.
     * @returns {Promise<any>} - The result of the delete operation.
     */
    static async deleteAll(query) {
        return storage.deleteMany(this.prototype.collection, query);
    }

    /**
     * Get a single instance from the database.
     * @param {object} query - The query to find the object.
     * @returns {Promise<any>} - The found object.
     */
    static async get(query) {
        return storage.findOne(this.prototype.collection, query);
    }

    /**
     * Get all instances from the database matching a query.
     * @param {object|null} query - The query to filter objects.
     * @returns {Promise<any[]>} - The found objects.
     */
    static async all(query = null) {
        return query
            ? storage.query(this.prototype.collection, query)
            : storage.all(this.prototype.collection);
    }

    /**
     * Get all instances from the database with options.
     * @param {object} query - The query to filter objects.
     * @param {object} options - The query options.
     * @returns {Promise<any[]>} - The found objects.
     */
    static async allWithOptions(query, options) {
        return storage.queryWithOptions(this.prototype.collection, query, options);
    }


    /**
     * Count the documents in a collection
     * @param {object} query - The parameters to match if available
     * @returns {Promise<number>} - The number of documents in a collection
     */
    static async count(query ={}){
       return this.prototype.execute(() => {
            storage.count(this.prototype.collection, query);
        })
    }

}

export default Basemodel;
