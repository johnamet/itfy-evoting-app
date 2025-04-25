#!/usr/bin/node

/**
 * VoteBundleController handles vote bundle operations.
 * Includes creating, listing, and updating vote bundles.
 */

import VoteBundle from "../models/voteBundle.js";
import { ObjectId } from "mongodb";
class VoteBundleController {
  /**
   * Create a new vote bundle.
   */
  static async createVoteBundle(req, res) {
    try {
      const {
        category_ids,
        event_id,
        name,
        votes_in_bundle,
        price_per_vote,
        discount,
        promo_code,
        active
      } = req.body;

      if (!category_ids || !event_id || !name || !votes_in_bundle || !price_per_vote) {
        return res.status(400).send({
          success: false,
          error: "Missing required fields",
        });
      }

      const bundle = new VoteBundle(
        category_ids,
        event_id,
        name,
        votes_in_bundle,
        price_per_vote,
        discount || 0,
        promo_code || null,
        active !== undefined ? active : true
      );

      const result = await bundle.save();
      if (!result) {
        return res.status(500).send({
          success: false,
          error: "Failed to create vote bundle",
        });
      }

      return res.status(201).send({
        success: true,
        bundle: bundle.to_object(),
      });
    } catch (e) {
      return res.status(500).send({ success: false, error: e.message });
    }
  }

  /**
   * List all vote bundles or filter by query.
   */
  static async listVoteBundles(req, res) {
    try {
      const query = req.query || {};
      const bundles = await VoteBundle.all(query);

      return res.status(200).send({
        success: true,
        bundles,
      });
    } catch (e) {
      return res.status(500).send({ success: false, error: e.message });
    }
  }

  /**
   * Update an existing vote bundle.
   */
  static async updateVoteBundle(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      if (!id) {
        return res.status(400).send({
          success: false,
          error: "Missing vote bundle ID",
        });
      }

      let bundle = await VoteBundle.get({ id: new ObjectId(id) });

      if (!bundle) {
        return res.status(404).send({
          success: false,
          error: "Vote bundle not found",
        });
      }

      bundle = VoteBundle.from_object(bundle);
      await bundle.updateInstance(updates);

      return res.status(200).send({
        success: true,
        bundle: bundle.to_object(),
      });
    } catch (e) {
      return res.status(500).send({ success: false, error: e.message });
    }
  }

  /**
   * Get a specific vote bundle by ID.
   * 
   */
  static async getVoteBundle(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).send({
          success: false,
          error: "Missing vote bundle ID",
        });
      }

      const bundle = await VoteBundle.get({ id: new ObjectId(id) });

      if (!bundle) {
        return res.status(404).send({
          success: false,
          error: "Vote bundle not found",
        });
      }

      return res.status(200).send({
        success: true,
        bundle: bundle,
      });
    } catch (e) {
      return res.status(500).send({ success: false, error: e.message });
    }
  }
  /**
   * Delete a vote bundle.
   */
  static async deleteVoteBundle(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).send({
          success: false,
          error: "Missing vote bundle ID",
        });
      }

      const bundle = await VoteBundle.get({ id });

      if (!bundle) {
        return res.status(404).send({
          success: false,
          error: "Vote bundle not found",
        });
      }

      await bundle.delete();

      return res.status(200).send({
        success: true,
        message: "Vote bundle deleted successfully",
      });
    } catch (e) {
      return res.status(500).send({ success: false, error: e.message });
    }
  }
}

export default VoteBundleController;
