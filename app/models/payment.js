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
  }
}

export default Payment;
