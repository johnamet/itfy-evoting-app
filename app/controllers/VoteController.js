#!/usr/bin/node

/**
 * VoteController handles the voting operations.
 * It includes methods for casting votes, retrieving vote statistics, and vote summaries.
 */

import Vote from "../models/vote.js";
import VoteBundle from "../models/voteBundle.js";
import Category from "../models/category.js";
import Candidate from "../models/candidate.js";
import Event from "../models/event.js";
import { ObjectId } from "mongodb";
import { verifyPayment } from "../utils/payment_checker.js";
import PromoCode from "../models/promocode.js";
import Payment from "../models/payment.js";

class VoteController {
  
  /**
   * Cast a vote for a candidate.
   * @param {Object} req - The request object containing vote details.
   * @param {Object} res - The response object to send the result.
   */

  static async castVote(req, res) {
    const {
      candidate_reference_code,
      event_id,
      category_id,
      vote, // { vote_bundle_id1: quantity1, vote_bundle_id2: quantity2 }
      payment_reference_code,
    } = req.body;
  
    const { ip } = req.headers;
    const voter_ip = ip || req.connection.remoteAddress;
  
    try {
      // 1. Validate candidate
      const candidate = await Candidate.get({ reference_code: candidate_reference_code });
      if (!candidate) return res.status(400).send({ success: false, error: "Candidate not found" });
  
      // 2. Validate event
      const event = await Event.get({ id: new ObjectId(event_id) });
      if (!event) return res.status(400).send({ success: false, error: "Event not found" });
  
      // 3. Validate category
      const category = await Category.get({ id: new ObjectId(category_id) });
      if (!category) return res.status(400).send({ success: false, error: "Category not found" });
  
      // 4. Confirm candidate's participation
      if (!new ObjectId(candidate.event_id).equals(event.id))
        return res.status(400).send({ success: false, error: "Candidate not in the event" });
  
      if (!candidate.category_ids.includes(category_id))
        return res.status(400).send({ success: false, error: "Candidate not in the category" });
  
      // 5. Verify payment
      const payment = await verifyPayment(payment_reference_code);
      if (!payment.verified)
        return res.status(400).send({ success: false, error: payment.reason });
  
      const paymentVoteMap = payment.data.metadata?.vote;
      if (!paymentVoteMap || typeof paymentVoteMap !== "object")
        return res.status(400).send({ success: false, error: "Invalid or missing vote metadata in payment" });
  
      // Check if vote structure matches
      if (JSON.stringify(paymentVoteMap) !== JSON.stringify(vote))
        return res.status(400).send({ success: false, error: "Vote metadata mismatch" });
  
      let expected_amount = 0;
      let total_votes = 0;
  
      for (const [bundleIdStr, quantity] of Object.entries(vote)) {
        const bundleId = new ObjectId(bundleIdStr);
        const vote_bundle = await VoteBundle.get({ id: bundleId });
        if (!vote_bundle)
          return res.status(400).send({ success: false, error: `Vote bundle ${bundleIdStr} not found` });
  
        if (!vote_bundle.event_id.equals(event.id))
          return res.status(400).send({ success: false, error: `Bundle ${bundleIdStr} not in the event` });
  
        if (!vote_bundle.category_ids.includes(category_id))
          return res.status(400).send({ success: false, error: `Bundle ${bundleIdStr} not in the category` });
  
        if (!vote_bundle.active)
          return res.status(400).send({ success: false, error: `Bundle ${bundleIdStr} is inactive` });
  
        const bundlePrice = vote_bundle.price_per_vote * vote_bundle.votes_in_bundle * quantity;
        expected_amount += bundlePrice;
        total_votes += vote_bundle.votes_in_bundle * quantity;
      }
  
      // 6. Apply promo code if available
      const promo_code_str = payment.data.metadata?.promo_code;
      if (promo_code_str) {
        const promo_code = await PromoCode.get({ code: promo_code_str });
  
        if (!promo_code || !promo_code.active)
          return res.status(400).send({ success: false, error: "Invalid or inactive promo code" });
  
        // Check all vote_bundle_ids are applicable
        for (const bundleIdStr of Object.keys(vote)) {
          if (!promo_code.applicable_bundle_ids.includes(bundleIdStr))
            return res.status(400).send({ success: false, error: `Promo code not valid for bundle ${bundleIdStr}` });
        }
  
        if (promo_code.expiration_date && new Date(promo_code.expiration_date) < new Date())
          return res.status(400).send({ success: false, error: "Promo code has expired" });
  
        if (promo_code.usage_limit && promo_code.used_by.length >= promo_code.usage_limit)
          return res.status(400).send({ success: false, error: "Promo code usage limit reached" });
  
        // Apply discount
        const discountAmount = (promo_code.discount / 100) * expected_amount;
        expected_amount = Math.round(expected_amount - discountAmount);
  
        promo_code.used_by.push(payment.data.customer_id);
        await promo_code.updateInstance(promo_code.to_object());
      }
  
      // 7. Final amount check
      if (Math.abs(payment.data.amount - expected_amount) > 1) {
        return res.status(400).send({
          success: false,
          error: `Payment amount (${payment.data.amount}) does not match expected price (${expected_amount})`,
        });
      }
  
      // 8. Cast the vote
      const voteEntry = new Vote(
        candidate.id,
        event.id,
        category.id,
        total_votes,
        voter_ip,
        null,
        {vote_bundle_ids : Object.keys(vote)},
      );
  
      const vote_result = await voteEntry.save();
      if (!vote_result)
        return res.status(500).send({ success: false, error: "Vote not saved" });
  
      // 9. Update payment
      payment.redeemed = true;
      payment.redeemed_at = new Date();
      payment.redeemed_by = candidate.id;
      const payment_result = await payment.updateInstance(payment.to_object());
  
      if (!payment_result)
        return res.status(500).send({ success: false, error: "Payment not updated" });
  
      return res.status(200).send({
        success: true,
        message: "Vote cast successfully",
        vote: voteEntry.to_object(),
      });
    } catch (err) {
      console.error("Error casting vote:", err);
      return res.status(500).send({ success: false, error: "Internal server error" });
    }
  }

  static async manualVoteFromPayment(req, res) {
    const { payment_reference_code, candidate_reference_code, event_id, category_id } = req.body;
  
    const { ip } = req.headers;
    const voter_ip = ip || req.connection.remoteAddress;
    let total_votes = 0;
    let expected_amount = 0;
  
    try {
      // 1. Get payment and validate
      const payment = await verifyPayment(payment_reference_code);
      if (!payment.verified)
        return res.status(400).send({ success: false, error: payment.reason });
  
      if (payment.data.redeemed)
        return res.status(400).send({ success: false, error: "Payment already redeemed" });

      const vote_bundle_ids = payment.data.metadata.bundles;
      if (!vote_bundle_ids || typeof vote_bundle_ids !== "object" || !Array.isArray(vote_bundle_ids))
        return res.status(400).send({ success: false, error: "Invalid vote metadata in payment" });
  
      // 2. Validate candidate
      const candidate = await Candidate.get({ reference_code: candidate_reference_code });
      if (!candidate)
        return res.status(400).send({ success: false, error: "Candidate not found" });
  
      // 3. Validate event
      const event = await Event.get({ id: new ObjectId(event_id) });
      if (!event)
        return res.status(400).send({ success: false, error: "Event not found" });
  
      // 4. Validate category
      const category = await Category.get({ id: new ObjectId(category_id) });
      if (!category)
        return res.status(400).send({ success: false, error: "Category not found" });
  
      // 5. Confirm candidate participation
      if (!new ObjectId(candidate.event_id).equals(event.id))
        return res.status(400).send({ success: false, error: "Candidate not in the event" });

      if (!candidate.category_ids.includes(category_id))
        return res.status(400).send({ success: false, error: "Candidate not in the category" });

      // 6. Validate all vote bundles and compute total votes and amount
      for (const bundle of vote_bundle_ids) {
        const vote_bundle = await VoteBundle.get({ id: new ObjectId(bundle.bundle_id) });
        if (!vote_bundle)
          return res.status(400).send({ success: false, error: `Vote bundle ${bundle.bundle_id} not found` });
      
        if (!new ObjectId(vote_bundle.event_id).equals(event.id))
          return res.status(400).send({ success: false, error: `Bundle ${bundle.bundle_id} not in the event` });
      
        if (!vote_bundle.category_ids.includes(category_id))
          return res.status(400).send({ success: false, error: `Bundle ${bundle.bundle_id} not in the category` });
      
        if (!vote_bundle.active)
          return res.status(400).send({ success: false, error: `Bundle ${bundle.bundle_id} is inactive` });
      
        total_votes += vote_bundle.votes_in_bundle * bundle.quantity;
        let bundlePrice = vote_bundle.price_per_vote * vote_bundle.votes_in_bundle * bundle.quantity;

        // Apply promo code if available for this bundle
        const promo_code_str = bundle.discount_code;
        if (promo_code_str && typeof promo_code_str === 'string' && promo_code_str.trim() !== '') {
          const promo_code = await PromoCode.get({ code: promo_code_str });
  
          if (!promo_code || !promo_code.active)
            return res.status(400).send({ success: false, error: `Invalid or inactive promo code for bundle ${bundle.bundle_id}` });
  
          // Check if promo code is applicable to this bundle
          if (!promo_code.applicable_bundle_ids.includes(bundle.bundle_id))
            return res.status(400).send({ success: false, error: `Promo code not valid for bundle ${bundle.bundle_id}` });
  
          if (promo_code.expiration_date && new Date(promo_code.expiration_date) < new Date())
            return res.status(400).send({ success: false, error: `Promo code for bundle ${bundle.bundle_id} has expired` });
  
          if (promo_code.usage_limit && promo_code.used_by.length >= promo_code.usage_limit)
            return res.status(400).send({ success: false, error: `Promo code usage limit reached for bundle ${bundle.bundle_id}` });
  
          // Apply discount to this bundle's price
          const discountAmount = (promo_code.discount / 100) * bundlePrice;
          bundlePrice = Math.round(bundlePrice - discountAmount);
  
          // Update promo code usage
          promo_code.used_by.push(payment.data.customer_id);
          await promo_code.updateInstance(promo_code.to_object());
        }

        expected_amount += bundlePrice;
      }

      // 7. Final amount check
      if (Math.abs(payment.data.amount/100 - expected_amount) > 1) {
        return res.status(400).send({
          success: false,
          error: `Payment amount (${payment.data.amount}) does not match expected price (${expected_amount})`,
        });
      }
  
      // 8. Cast the vote
      const vote = new Vote(
        candidate.id,
        event_id,
        category_id,
        total_votes,
        voter_ip,
        null,
        { vote_bundle_ids: vote_bundle_ids.map(bundle => bundle.bundle_id) }
      );
  
      const vote_result = await vote.save();

      
      if (!vote_result)
        return res.status(500).send({ success: false, error: "Vote not saved" });

      // io.emit(`voteUpdate${candidate.id}`)
      // 9. Mark payment as redeemed
      payment.data.redeemed = true;
      payment.data.redeemed_at = new Date();
      payment.data.redeemed_for = candidate.id;
      payment.data.redeemed_by = voter_ip;
      
      const payment_result = await payment.data.save();
      if (!payment_result)
        return res.status(500).send({ success: false, error: "Payment not updated" });
  
      return res.status(200).send({
        success: true,
        message: "Vote cast successfully",
        vote: vote.to_object(),
      });
    } catch (err) {
      console.error("Error in manual vote:", err);
      return res.status(500).send({ success: false, error: "Internal server error" });
    }
} 
  
  

  static async voteStats(req, res) {
    try {
      const { event_id } = req.query;
  
      // Match stage with string-based event_id if provided
      const matchStage = event_id ? { event_id } : {};
  
      const stats = await Vote.aggregate([
        { $match: matchStage },
  
        // Group by event, category, candidate and sum number_of_votes
        {
          $group: {
            _id: {
              event: "$event_id",
              category: "$category_id",
              candidate: "$candidate_id"
            },
            votes: { $sum: "$number_of_votes" }
          }
        },
        {
          $addFields: {
            eventObjectId: { $toObjectId: "$_id.event" },
            categoryObjectId: { $toObjectId: "$_id.category" },
            candidateObjectId: { $toObjectId: "$_id.candidate" }
          }
        },
  
        // Lookup event details
        {
        
          $lookup: {
            from: "events",
            localField: "eventObjectId",
            foreignField: "id",
            as: "event"
          }
        },
        { $unwind: "$event" },

         // Lookup category details
         {
          $lookup: {
            from: "categories",
            localField: "categoryObjectId",
            foreignField: "id",
            as: "category"
          }
        },
        { $unwind: "$category" },
  
        // Lookup candidate details
        {
          $lookup: {
            from: "candidates",
            localField: "candidateObjectId",
            foreignField: "id",
            as: "candidate"
          }
        },
        { $unwind: "$candidate" },
  
        // Clean up the structure
        {
          $project: {
            event_id: "$event.id",
            event_name: "$event.name",
            category_id: "$category.id",
            category_name: "$category.name",
            candidate_id: "$candidate.id",
            candidate_name: "$candidate.name",
            votes: 1
          }
        },
  
        // Group candidates by category
        {
          $group: {
            _id: {
              event_id: "$event_id",
              event_name: "$event_name",
              category_id: "$category_id",
              category_name: "$category_name"
            },
            candidates: {
              $push: {
                candidate_id: "$candidate_id",
                candidate_name: "$candidate_name",
                votes: "$votes"
              }
            }
          }
        },
  
        // Group categories by event
        {
          $group: {
            _id: {
              event_id: "$_id.event_id",
              event_name: "$_id.event_name"
            },
            categories: {
              $push: {
                category_id: "$_id.category_id",
                category_name: "$_id.category_name",
                candidates: "$candidates"
              }
            }
          }
        },
  
        // Final projection
        {
          $project: {
            _id: 0,
            event_id: "$_id.event_id",
            event_name: "$_id.event_name",
            categories: 1
          }
        }
  
       
      ]);

      console.log('Hi there', stats)
  
      return res.status(200).send({ success: true, stats });
    } catch (err) {
      console.error("Error getting vote stats:", err);
      return res.status(500).send({ success: false, error: "Internal server error" });
    }
  }
  

  /**
   * Get a summary of votes for a specific event (optionally filtered by category or candidate).
   * @param {Object} req - Request object containing query parameters.
   * @param {Object} res - Response object to send the result.
   */
  static async voteSummary(req, res) {
    const { event_id, candidate_id, category_id } = req.query;
  
    try {
      if (!event_id) {
        return res.status(400).json({ success: false, error: "Missing event ID" });
      }
  
      // Build match stage with properly cast ObjectIds
      const matchStage = {
        event_id: new ObjectId(event_id)
      };
  
      if (candidate_id) matchStage.candidate_id = new ObjectId(candidate_id);
      if (category_id) matchStage.category_id = new ObjectId(category_id);
  
      const summary = await Vote.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: "$candidate_id",
            total_votes: { $sum: "$number_of_votes" },
          },
        },
        {
          $lookup: {
            from: "candidates",
            localField: "_id", // _id is candidate_id here
            foreignField: "id", // matching candidate.id
            as: "candidate",
          },
        },
        { $unwind: "$candidate" },
        {
          $project: {
            _id: 0,
            candidate_id: "$candidate.id",
            candidate_name: "$candidate.name",
            total_votes: 1,
          },
        },
        { $sort: { total_votes: -1 } },
      ]);
  
      return res.status(200).json({ success: true, summary });
  
    } catch (error) {
      console.error("Error getting vote summary:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
  


/**
 * Get all votes for a specific query (grouped by date).
 * @param {Object} req - The request object containing event ID.
 * @param {Object} res - The response object to send the result.
 */
static async getAllVotes(req, res) {
  const { query } = req.query;
  const { event_id } = req.params;

  try {
    let queryObj = {};

    // Parse query string
    if (query) {
      try {
        queryObj = JSON.parse(query);

        // // Convert relevant fields to ObjectId
        // if (queryObj.event_id) queryObj.event_id = new ObjectId(queryObj.event_id);
        // if (queryObj.candidate_id) queryObj.candidate_id = new ObjectId(queryObj.candidate_id);
        // if (queryObj.category_id) queryObj.category_id = new ObjectId(queryObj.category_id);
        // if (queryObj.bundle_id) queryObj.bundle_id = new ObjectId(queryObj.bundle_id);
      } catch (e) {
        return res.status(400).json({ success: false, error: "Invalid query format" });
      }
    }

    // Add event_id from route param if not in query
    if (event_id && !queryObj.event_id) {
      queryObj.event_id = event_id;
    }

    const votes = await Vote.aggregate([
      { $match: queryObj },
      { $sort: { date: 1 } }
    ]);

    if (!votes || votes.length === 0) {
      return res.status(404).json({ success: false, error: "No votes found" });
    }

    return res.status(200).json({ success: true, votes });

  } catch (err) {
    console.error("Error getting all votes:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}
}

export default VoteController;
