/**
 * The votes
 */
import Basemodel from "./basemodel.js";

/**
 * Represents a vote in the e-voting application.
 * 
 * @class Vote
 * @extends {Basemodel}
 * 
 * @property {string} collection - The name of the collection in the database.
 * @property {string} candidate_id - The ID of the candidate being voted for.
 * @property {string} event_id - The ID of the event where the vote is cast.
 * @property {string} category_id - The ID of the category in which the vote is cast.
 * @property {number} number_of_votes - The number of votes cast (default is 1).
 * @property {string} voter_ip - The IP address of the voter.
 * @property {string} [bundle_id] - The ID of the vote bundle (optional).
 * 
 * @param {string} candidate_id - The ID of the candidate being voted for.
 * @param {string} event_id - The ID of the event where the vote is cast.
 * @param {string} category_id - The ID of the category in which the vote is cast.
 * @param {number} [number_of_votes=1] - The number of votes cast (default is 1).
 * @param {string} voter_ip - The IP address of the voter.
 * @param {string} [bundle_id] - The ID of the vote bundle (optional).
 * @param {...any} kwargs - Additional arguments to be passed to the base model.
 */
class Vote extends Basemodel{

    static collection = "votes";

    constructor(candidate_id, event_id,
                category_id, number_of_votes= 1,
                voter_ip, bundle_id = null, ...kwargs) {
        super(...kwargs);
        this.candidate_id = candidate_id;
        this.event_id = event_id;
        this.category_id = category_id;
        this.number_of_votes = number_of_votes;
        this.voter_ip = voter_ip;
        this.bundle_id = bundle_id;
    }
}

export default Vote;