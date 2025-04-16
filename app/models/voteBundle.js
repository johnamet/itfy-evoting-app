import Basemodel from "./basemodel.js";

/**
 * Represents a bundle of votes with pricing and promotional options.
 * 
 * @class VoteBundle
 * @extends {Basemodel}
 * 
 * @property {string} collection - The name of the collection in the database.
 * @property {Array<string>} category_ids - The IDs of the category this bundle applies to.
 * @property {string} name - The name of the bundle.
 * @property {number} votes_in_bundle - Number of votes included in this bundle.
 * @property {string} event_id - The ID of the event this bundle is associated with.
 * @property {number} price_per_vote - Price per vote in this bundle.
 * @property {boolean} [active] - Whether this bundle is currently active.
 * 
 * @param {string} category_id
 * @param {string} name
 * @param {number} votes_in_bundle
 * @param {number} price_per_vote
 * @param {boolean} [active]
 * @param {...any} kwargs
 */
class VoteBundle extends Basemodel {
    static collection = "vote_bundles";
  
    constructor(
      category_ids,
      event_id,
      name,
      votes_in_bundle,
      price_per_vote,
      active = true,
      ...kwargs
    ) {
      super(...kwargs);
      this.category_ids = category_ids;
      this.event_id = event_id;
      this.name = name;
      this.votes_in_bundle = votes_in_bundle;
      this.price_per_vote = price_per_vote;
      this.active = active;
    }
  }
  

export default VoteBundle;
