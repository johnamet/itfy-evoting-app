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

const storage = new StorageEngine();
storage.connect();

class AppController{

    static async getStatus(req, res) {
        const status = {
            'connection': 'Ok',
            'db': {
                'connection': await storage.isConnected(),
                'latency': await storage.getLatency()
            }
        }

        return res.status(200).send(status);
    }

    static async getStats(req, res) {

        const count = {
            'candidates': await Candidate.count(),
            'categories': await Category.count(),
            'events': await Event.count(),
            'nominations': await Nomination.count(),
            'roles': await Role.count(),
            'users': await Users.count(),
            'votes': await Vote.count()
        }

        return res.status(200).send(count)
    }
}

export default AppController;