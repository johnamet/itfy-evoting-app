import Basemodel from "./basemodel.js";

/**
 * Represents a promotional code that provides discounts on vote bundles.
 * 
 * @class PromoCode
 * @extends {Basemodel}
 * 
 * @property {string} collection - The name of the collection in the database.
 * @property {string} code - The promo code string (e.g., "SAVE10").
 * @property {number} discount - The discount percentage applied (e.g., 20 for 20% off).
 * @property {Array<string>} applicable_bundle_ids - IDs of vote bundles this promo code applies to.
 * @property {Date} [expiration_date] - Optional expiration date.
 * @property {number} [usage_limit] - Optional maximum number of times this code can be used.
 * @property {Array<string>} [used_by] - Optional list of user IDs who have used the code.
 * @property {boolean} active - Whether the promo code is currently active.
 * 
 * @param {string} code
 * @param {number} discount
 * @param {Array<string>} applicable_bundle_ids
 * @param {Date} [expiration_date]
 * @param {number} [usage_limit]
 * @param {Array<string>} [used_by]
 * @param {boolean} [active]
 * @param {...any} kwargs
 */
class PromoCode extends Basemodel {
  static collection = "promo_codes";

  constructor(
    code,
    discount,
    applicable_bundle_ids = [],
    expiration_date = null,
    usage_limit = null,
    used_by = [],
    active = true,
    ...kwargs
  ) {
    super(...kwargs);
    this.code = code;
    this.discount = discount;
    this.applicable_bundle_ids = applicable_bundle_ids;
    this.expiration_date = expiration_date;
    this.usage_limit = usage_limit;
    this.used_by = used_by;
    this.active = active;
  }
}

export default PromoCode;
