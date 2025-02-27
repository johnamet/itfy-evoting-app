/**
 * Nomination
 *
 * A class representing a nomination in the system. This class extends the Basemodel
 * and provides a structure for nomination-related data and operations.
 */

import Basemodel from "./basemodel.js";

class Nomination extends Basemodel {

    static collection = "nominations";

    /**
     * Constructs a new Nomination instance.
     *
     * @param {string} candidate_id - The ID of the candidate being nominated.
     * @param {string} event_id - The ID of the event associated with the nomination.
     * @param {string} category_id - The ID of the category for which the candidate is nominated.
     * @param {...object} kwargs - Additional fields to dynamically add to the nomination.
     */
    constructor(candidate_id, event_id, category_id, ...kwargs) {
        super(...kwargs); // Call the Basemodel constructor with additional fields

        this.candidate_id = candidate_id; // Assign the candidate ID
        this.event_id = event_id; // Assign the event ID
        this.category_id = category_id; // Assign the category ID
    }
}


class NominationForm extends Basemodel {
	static collection = "nomination_forms";

	constructor(...params){
		super(params)
	}
}

export default Nomination;
export {NominationForm};
