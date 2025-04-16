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
      vote_bundle_id,
      payment_reference_code,
    } = req.body;
  
    const { ip } = req.headers;
    const voter_ip = ip || req.connection.remoteAddress;
  
    try {
      // 1. Validate candidate
      const candidate = await Candidate.get({ reference_code: candidate_reference_code });
      if (!candidate) {
        return res.status(400).send({ success: false, error: "Candidate not found" });
      }
  
      // 2. Validate event
      const event = await Event.get({ id: new ObjectId(event_id) });
      if (!event) {
        return res.status(400).send({ success: false, error: "Event not found" });
      }
  
      // 3. Validate category
      const category = await Category.get({ id: new ObjectId(category_id) });
      if (!category) {
        return res.status(400).send({ success: false, error: "Category not found" });
      }
  
      // 4. Confirm candidate's participation in event and category
      if (!candidate.event_id.equals(event.id)) {
        return res.status(400).send({ success: false, error: "Candidate not in the event" });
      }
  
      if (!candidate.category_ids.includes(category.id)) {
        return res.status(400).send({ success: false, error: "Candidate not in the category" });
      }
  
      // 5. Validate vote bundle
      const vote_bundle = await VoteBundle.get({ id: new ObjectId(vote_bundle_id) });
      if (!vote_bundle) {
        return res.status(400).send({ success: false, error: "Vote bundle not found" });
      }
  
      if (!vote_bundle.event_id.equals(event.id)) {
        return res.status(400).send({ success: false, error: "Vote bundle not in the event" });
      }
  
      if (!vote_bundle.category_ids.includes(category.id)) {
        return res.status(400).send({ success: false, error: "Vote bundle not in the category" });
      }
  
      if (!vote_bundle.active) {
        return res.status(400).send({ success: false, error: "Vote bundle not active" });
      }
  
      // 6. Verify payment
      const payment = await verifyPayment(payment_reference_code);
      if (!payment.verified) {
        return res.status(400).send({ success: false, error: payment.reason });
      }
  
      if (payment.data.vote_bundle_id !== vote_bundle.id) {
        return res.status(400).send({ success: false, error: "Payment not for the vote bundle" });
      }
  
      // 7. Verify amount including promo code (if any)
      const votePrice = vote_bundle.price_per_vote * vote_bundle.votes_in_bundle;
      let expected_amount = votePrice;
  
      const promo_code_str = payment.data.metadata?.promo_code;
      if (promo_code_str) {
        const promo_code = await PromoCode.get({ code: promo_code_str });
  
        if (!promo_code || !promo_code.active) {
          return res.status(400).send({ success: false, error: "Invalid or inactive promo code" });
        }
  
        // Check if promo code is applicable to this bundle
        if (
          !promo_code.applicable_bundle_ids.includes(vote_bundle.id.toString())
        ) {
          return res.status(400).send({ success: false, error: "Promo code not valid for this bundle" });
        }
  
        // Check for expiration
        if (promo_code.expiration_date && new Date(promo_code.expiration_date) < new Date()) {
          return res.status(400).send({ success: false, error: "Promo code has expired" });
        }
  
        // Check usage limit
        if (
          promo_code.usage_limit &&
          promo_code.used_by.length >= promo_code.usage_limit
        ) {
          return res.status(400).send({ success: false, error: "Promo code usage limit reached" });
        }
  
        // Apply discount
        const discountAmount = (promo_code.discount / 100) * votePrice;
        expected_amount = Math.round(votePrice - discountAmount);
  
        // Add user to used_by list
        promo_code.used_by.push(payment.data.customer_id); // optional: depends on your structure
        await promo_code.updateInstance(promo_code.to_object());
      }
  
      // Final amount check (allowing minor rounding)
      if (Math.abs(payment.data.amount - expected_amount) > 1) {
        return res.status(400).send({
          success: false,
          error: `Payment amount (${payment.data.amount}) does not match expected price (${expected_amount})`,
        });
      }
  
      // 8. Cast the vote
      const vote = new Vote(
        candidate.id,
        event.id,
        category.id,
        vote_bundle.votes_in_bundle,
        voter_ip,
        vote_bundle.id
      );
  
      const vote_result = await vote.save();
      if (!vote_result) {
        return res.status(500).send({ success: false, error: "Vote not saved" });
      }
  
      // 9. Update payment status
      payment.redeemed = true;
      payment.redeemed_at = new Date();
      payment.redeemed_by = candidate.id;
  
      const payment_result = await payment.updateInstance(payment.to_object());
      if (!payment_result) {
        return res.status(500).send({ success: false, error: "Payment not updated" });
      }
  
      // TODO: Trigger notifications/emails here
  
      return res.status(200).send({
        success: true,
        message: "Vote cast successfully",
        vote: vote.to_object(),
      });
    } catch (err) {
      console.error("Error casting vote:", err);
      return res.status(500).send({ success: false, error: "Internal server error" });
    }
  }  
  

  static async voteStats(req, res) {
    try {
      // Optionally, filter by event_id if provided in query
      const { event_id } = req.query;
      const matchStage = event_id ? { event_id: new ObjectId(event_id) } : {};

      // Aggregate votes: group by event, then category, then candidate
      const stats = await Vote.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              event: "$event_id",
              category: "$category_id",
              candidate: "$candidate_id"
            },
            votes: { $sum: "$votes" }
          }
        },
        {
          $lookup: {
            from: "events",
            localField: "_id.event",
            foreignField: "_id",
            as: "event"
          }
        },
        { $unwind: "$event" },
        {
          $lookup: {
            from: "categories",
            localField: "_id.category",
            foreignField: "_id",
            as: "category"
          }
        },
        { $unwind: "$category" },
        {
          $lookup: {
            from: "candidates",
            localField: "_id.candidate",
            foreignField: "_id",
            as: "candidate"
          }
        },
        { $unwind: "$candidate" },
        {
          $project: {
            event_id: "$event._id",
            event_name: "$event.name",
            category_id: "$category._id",
            category_name: "$category.name",
            candidate_id: "$candidate._id",
            candidate_name: "$candidate.name",
            votes: 1
          }
        },
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
        {
          $project: {
            _id: 0,
            event_id: "$_id.event_id",
            event_name: "$_id.event_name",
            categories: 1
          }
        }
      ]);

      return res.status(200).send({ success: true, stats });
    } catch (err) {
      console.error("Error getting vote stats:", err);
      return res.status(500).send({ success: false, error: "Internal server error" });
    }
  }
}

export default VoteController;
