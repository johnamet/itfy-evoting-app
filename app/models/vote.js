/**
 * The votes
 */
import Basemodel from "./basemodel.js";

class Vote extends Basemodel{

    collection = "votes";

    constructor(candidate_id, event_id,
                category_id, number_of_votes,
                voter_ip, ...kwargs) {
        super(kwargs);
        this.candidate_id = candidate_id;
        this.event_id = event_id;
        this.category_id = category_id;
        this.number_of_votes = number_of_votes;
        this.voter_ip = voter_ip;
    }
}

export default Vote;