/**
 * The activity model, it extends from the base model
 */

import CacheEngine, { cacheEngine } from "../utils/engine/CacheEngine";


class Activity extends Basemodel {
    static collection = "activities";

    constructor(user, action, entity, entity_id, timestamp, ...kwargs) {
        super(...kwargs);

        this.user = user;
        this.action = action;
        this.entity = entity;
        this.entity_id = entity_id;
        this.timestamp = timestamp;
    }

    async save(){
        try {
            await cacheEngine.saveObject(this.id, this);
        } catch (error) {
            console.error(`Error saving activity: ${error.message}`);
            throw error;
        }
    }
}