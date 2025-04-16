import BaseModel from "./basemodel.js";

/**
 * Represents a verified payment stored locally.
 */
class Payment extends BaseModel {
  static collection = "payments";

  constructor(amount, status, reference_code, payment_method, redeemed, ...kwargs) {
    super(...kwargs);
    this.amount = amount;
    this.status = status;
    this.reference_code = reference_code;
    this.payment_method = payment_method;
    this.redeemed = redeemed;

    this.metadata = kwargs.metadata || {};
    this.customer_id = kwargs.customer_id || null;
    this.currency = kwargs.currency || "GHS";
    this.created_at = kwargs.created_at || new Date();
    this.redeemed_at = kwargs.redeemed_at || null;
    this.redeemed_by = kwargs.redeemed_by || null;
  }
}

export default Payment;
