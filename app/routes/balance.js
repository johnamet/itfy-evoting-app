/**
 * @file balance.js
 * 
 * This file contains the route handler for balance inquiries and transaction aggregation.
 * It fetches a list of transactions from the payment service and aggregates results
 * based on query parameters (metadata fields such as event_id, category_id, and candidate_id).
 * 
 */

import Router from "express";
import BalanceController from "../controllers/BalanceController.js";
import AuthController from "../controllers/AuthController.js";

const balanceRouter = Router();
/**
 * @route GET /balance/transactions
 * @group Balance - Operations related to balance inquiries and transaction aggregation
 * @param {string} event_id.query - Event ID to filter transactions
 * @param {string} category_id.query - Category ID to filter transactions
 * @param {string} candidate_id.query - Candidate ID to filter transactions
 * @returns {object} 200 - An array of transactions
 * @returns {Error}  500 - Internal server error
 */
balanceRouter.get(
  "/transactions",
  AuthController.verifyToken,
  AuthController.verifyRole(["admin"]),
  BalanceController.listTransactions
);

/**
 * @route GET /balance/transactions/aggregate
 * @group Balance - Operations related to balance inquiries and transaction aggregation
 * @param {string} event_id.query - Event ID to filter transactions
 * @param {string} category_id.query - Category ID to filter transactions
 * @param {string} candidate_id.query - Candidate ID to filter transactions
 * @returns {object} 200 - Aggregated transaction data
 * @returns {Error}  500 - Internal server error
 */
balanceRouter.get(
  "/transactions/aggregate",
  AuthController.verifyToken,
  AuthController.verifyRole(["admin"]),
  BalanceController.aggregateTransactions
);

/**
 * @route POST /balance/transactions/initialise-payment
 * @group Balance - Operations related to balance inquiries and transaction aggregation
 * @param {string} event_id.query - Event ID to filter transactions
 * @param {string} category_id.query - Category ID to filter transactions
 * @param {string} candidate_id.query - Candidate ID to filter transactions
 * @param {string} amount.query - Amount to be paid
 * @param {string} payment_method.query - Payment method to be used
 * @param {string} user_id.query - User ID to be used
 * @returns {object} 200 - Payment initialization data
 * @returns {Error}  500 - Internal server error
 */

balanceRouter.post(
    "/transactions/initialise-payment",
    BalanceController.initialisePayment
);


export default balanceRouter;