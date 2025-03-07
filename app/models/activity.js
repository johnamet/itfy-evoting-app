/**
 * The activity model, it extends from the base model
 */

import Basemodel from './basemodel.js'

class Activity extends Basemodel {
    static collection = "activities";

    constructor(user_id, action, entity, entity_id, timestamp, ...kwargs) {
        super(...kwargs);

        this.user_id = user_id;
        this.action = action;
        this.entity = entity;
        this.entity_id = entity_id;
        this.timestamp = timestamp;
    }
}

export default Activity;