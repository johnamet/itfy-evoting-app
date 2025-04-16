#!/usr/bin/node

/**
 * BalanceController handles balance inquiries and transaction aggregation.
 * It fetches a list of transactions from the payment service and
 * aggregates results based on query parameters (metadata fields such as event_id,
 * category_id, and candidate_id).
 */

import fetch from "node-fetch"; // Ensure node-fetch is installed: npm install node-fetch

class BalanceController {
  /**
   * Retrieves a list of transactions from the payment service.
   * Optional query parameters (e.g., event_id, category_id, candidate_id)
   * are passed along to the payment service endpoint.
   *
   * @param {Request} req - The request object containing query parameters.
   * @param {Response} res - The response object.
   */
  static async listTransactions(req, res) {
    try {
      const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL;
      if (!paymentServiceUrl) {
        return res.status(500).send({
          success: false,
          error: "Payment service URL not configured",
        });
      }

      // Construct the URL to fetch transactions.
      let url = `${paymentServiceUrl}/list-transactions`;
      const queryFilters = req.query || {};
      const queryString = new URLSearchParams(queryFilters).toString();
      if (queryString) {
        url += `?${queryString}`;
      }

      // Fetch transactions from the payment service.
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(500).send({
          success: false,
          error: `Failed to fetch transactions. Status: ${response.status}`,
        });
      }

      const transactions = await response.json();

      return res.status(200).send({
        success: true,
        transactions,
      });
    } catch (e) {
      console.error("Error in listTransactions:", e);
      return res.status(500).send({
        success: false,
        error: e.message,
      });
    }
  }

  /**
   * Aggregates transactions by summing the amount and counting the transactions.
   * Filters transactions using optional query parameters based on metadata:
   *   - event_id
   *   - category_id
   *   - candidate_id
   *
   * @param {Request} req - The request object containing query parameters.
   * @param {Response} res - The response object.
   */
  static async getAggregateBalance(req, res) {
    try {
      const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL;
      if (!paymentServiceUrl) {
        return res.status(500).send({
          success: false,
          error: "Payment service URL not configured",
        });
      }

      // Construct URL to fetch transactions.
      let url = `${paymentServiceUrl}/list-transactions`;
      const queryFilters = req.query || {};
      const queryString = new URLSearchParams(queryFilters).toString();
      if (queryString) {
        url += `?${queryString}`;
      }

      // Fetch transactions from the payment service.
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(500).send({
          success: false,
          error: `Failed to fetch transactions. Status: ${response.status}`,
        });
      }

      const transactions = await response.json();

      // Initialize aggregation variables.
      let totalAmount = 0;
      let transactionCount = 0;

      // Loop through and filter transactions based on metadata.
      // Expected metadata fields: event_id, category_id, candidate_id.
      transactions.forEach((txn) => {
        const metadata = txn.metadata || {};

        // For each query filter, check if the transaction metadata matches the query.
        let matches = true;
        if (queryFilters.event_id && metadata.event_id !== queryFilters.event_id) {
          matches = false;
        }
        if (queryFilters.category_id && metadata.category_id !== queryFilters.category_id) {
          matches = false;
        }
        if (queryFilters.candidate_id && metadata.candidate_id !== queryFilters.candidate_id) {
          matches = false;
        }

        if (matches) {
          totalAmount += txn.amount; // Assume txn.amount is a numeric field.
          transactionCount++;
        }
      });

      return res.status(200).send({
        success: true,
        aggregate: {
          totalAmount,
          transactionCount,
        },
      });
    } catch (e) {
      console.error("Error in getAggregateBalance:", e);
      return res.status(500).send({
        success: false,
        error: e.message,
      });
    }
  }
}

export default BalanceController;
