/**
 * The application controller
 */
import StorageEngine from "../utils/engine/StorageEngine.js";
import Candidate from "../models/candidate.js";
import Category from "../models/category.js";
import Nomination from "../models/nomination.js";
import Role from "../models/role.js";
import Users from "../models/basemodel.js";
import Vote from "../models/vote.js";
import Event from "../models/event.js";
import storage from "../utils/engine/StorageEngine.js";
import cacheEngine from "../utils/engine/CacheEngine.js";



class AppController {
    /**
     * Retrieve the status of the application, including database connection and latency.
     * @param {Request} req - The request object.
     * @param {Response} res - The response object.
     * @returns {Promise<Response>} - The status of the application.
     */
    static async getStatus(req, res) {
        try {
            const status = {
                connection: "Ok",
                db: {
                    connection: await storage.isConnected(),
                    latency: await storage.getLatency(),
                },
                cache: {
                    connection: await cacheEngine.isConnected(),
                    latency: await cacheEngine.getLatency()
                }
            };

            return res.status(200).send(status);
        } catch (error) {
            console.error("Error retrieving application status:", error);
            return res.status(500).send({ error: "Failed to retrieve application status." });
        }
    }

    /**
     * Retrieve statistics for various entities in the application.
     * @param {Request} req - The request object.
     * @param {Response} res - The response object.
     * @returns {Promise<Response>} - The statistics for the entities.
     */
    static async getStats(req, res) {
        try {
            const count = {
                candidates: await Candidate.count()  || 0,
                categories: await Category.count() || 0,
                events: await Event.count() || 0,
                nominations: await Nomination.count() || 0,
                roles: await Role.count() || 0,
                users: await Users.count() || 0,
                votes: await Vote.count() || 0,
            };

            return res.status(200).send(count);
        } catch (error) {
            console.error("Error retrieving application statistics:", error);
            return res.status(500).send({ error: "Failed to retrieve application statistics." });
        }
    }
}

export default AppController;
