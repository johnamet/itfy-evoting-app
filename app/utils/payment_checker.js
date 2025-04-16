import Payment from "../models/payment.js";

/**
 * Verifies payment using external service and ensures it's saved locally.
 * Metadata (including promo codes) is stored for further processing.
 *
 * @param {string} reference_code - The reference code of the payment to verify.
 * @returns {Promise<Object>} - { verified: boolean, data: Payment | reason: string }
 */
async function verifyPayment(reference_code) {
  try {
    const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL;

    if (!paymentServiceUrl) {
      throw new Error("Payment service URL not configured");
    }

    // 1. Fetch from external payment service
    const response = await fetch(`${paymentServiceUrl}/verify/${reference_code}`);

    if (!response.ok) {
      throw new Error(`Payment verification failed with status: ${response.status}`);
    }

    const responseBody = await response.json();

    if (responseBody.status !== "success") {
      return {
        verified: false,
        reason: responseBody.message || "Payment not successful",
      };
    }

    const paymentData = responseBody.data;
    const metadata = paymentData.metadata || {};

    // 2. Check for existing local payment
    let localPayment = await Payment.get({ id: reference_code });

    if (!localPayment) {
      // 3. Create and save new payment
      localPayment = new Payment(
        paymentData.amount,
        paymentData.status,
        paymentData.reference,
        paymentData.payment_method || "unknown",
        false,
        {
          _id: reference_code,
          customer_id: paymentData.customer?.id || null,
          metadata: metadata,
          currency: paymentData.currency || "NGN",
          created_at: new Date(paymentData.created_at || Date.now()),
        }
      );
      await localPayment.save();
    }

    return {
      verified: true,
      data: localPayment,
    };
  } catch (error) {
    console.error("Error verifying payment:", error);
    return {
      verified: false,
      reason: error.message || "Unexpected error during payment verification",
    };
  }
}

export { verifyPayment };
