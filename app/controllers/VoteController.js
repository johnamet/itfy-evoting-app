#!/usr/bin/node

/**
 * VoteController handles the voting operations.
 * It includes methods for casting votes, retrieving vote statistics, and vote summaries.
 */

import Vote from "../models/vote.js";
import Event from "../models/event.js";
import { ObjectId } from "mongodb";

class VoteController {
  /**
   * Casts a vote.
   * @param {Request} req - The request object containing vote details.
   * @param {Response} res - The response object.
   */
  static async castVote(req, res) {
    try {
      const { candidate_id, event_id, category_id, number_of_votes, voter_ip } = req.body;

      if (!event_id || !category_id || !candidate_id) {
        return res.status(400).send({ success: false, error: "Missing required fields. `event_id` or `category_id` or `candidate_id`" });
      }

      const event = await Event.get({id: new ObjectId(event_id)});
      if (!event) return res.status(404).send({ success: false, error: "Event not found." });

      const vote = new Vote(candidate_id, event_id, category_id, number_of_votes || 1, voter_ip || req.ip);
      await vote.save();

      // Broadcast to all clients
      req.io.emit("newVote", vote);

      res.status(201).send({ success: true, message: "Vote cast successfully.", vote });
    } catch (error) {
      console.error("Error casting vote:", error);
      res.status(500).send({ success: false, error: "Internal Server Error" });
    }
  }

  /**
   * Retrieves vote summary for an event.
   * @param {Request} req - The request object containing event ID.
   * @param {Response} res - The response object.
   */
  static async getVoteSummary(req, res) {
    try {
      const { event_id } = req.query;

      if (!event_id) return res.status(400).send({ success: false, error: "Missing event_id." });

      const eventObj = await Event.get({ id: new ObjectId(event_id) });
      const event = eventObj ? Event.fromObject(eventObj) : null;

      if (!event) return res.status(404).send({ success: false, error: "Event not found." });

      const totalVotes = await Vote.count({ event_id: event_id });

      const categoryVotes = await Vote.aggregate([
        { $match: { event_id: event_id } },
        { $group: { _id: "$category_id", votes: { $sum: 1 } } },
      ]);

      const candidateVotes = await Vote.aggregate([
        { $match: { event_id: event_id } },
        { $group: { _id: "$candidate_id", votes: { $sum: 1 } } },
        { $sort: { votes: -1 } },
      ]);

      const summary = {
        totalVotes,
        categoryVotes,
        candidateVotes,
        eventStatus: new Date() < event.start_date ? "pending" : new Date() > event.end_date ? "ended" : "ongoing",
      };

      res.status(200).send({ success: true, summary });
    } catch (error) {
      console.error("Error fetching vote summary:", error);
      res.status(500).send({ success: false, error: "Internal Server Error" });
    }
  }

  /**
   * Retrieves vote statistics for an event and optionally a category.
   * @param {Request} req - The request object containing event ID and optional category ID.
   * @param {Response} res - The response object.
   */
  static async getVoteStats(req, res) {
    try {
      const { event_id, category_id } = req.query;

      if (!event_id) return res.status(400).send({ success: false, error: "Missing event_id." });

      const stats = await Vote.aggregate([
        { $match:  !category_id ? { event_id: event_id } : { event_id: event_id, category_id: category_id } },
        { $group: { _id: "$candidate_id", votes: { $sum: 1 } } },
      ]);

      res.status(200).send({ success: true, stats });
    } catch (error) {
      console.error("Error fetching vote stats:", error);
      res.status(500).send({ success: false, error: "Internal Server Error" });
    }
  }
}

export default VoteController;
