import Vote from "../models/vote.js";
import Event from "../models/event.js";
import Category from "../models/category.js";
import Candidate from "../models/candidate.js";
import { ObjectId } from "mongodb";

class VoteController {
    /**
     * Casts a new vote.
     */
    static async castVote(req, res) {
        try {
            const data = req.body;

            if (!data) {
                return res.status(400).send({
                    success: false,
                    error: "Missing data."
                });
            }

            const { candidate_id, event_id, category_id, voter_ip,
                 voting_id } = data;

            if (!event_id || !category_id || !voter_ip) {
                return res.status(400).send({
                    success: false,
                    error: "Missing required fields: `candidate_id`, `event_id`, `category_id`, or `voter_ip`."
                });
            }

            if(!candidate_id && !voting_id){
                return res.status(400).send({
                    success: false,
                    error: "Either a `candidate_id` or a `voting_id` is required."
                });
            }

            // Validate event
            const event = await Event.get({ id: new ObjectId(event_id) });
            if (!event) {
                return res.status(404).send({
                    success: false,
                    error: "Event not found."
                });
            }

            // Validate category
            const category = await Category.get({ id: new ObjectId(category_id) });
            if (!category || category.eventId !== event_id) {
                return res.status(404).send({
                    success: false,
                    error: "Category not found or does not belong to the specified event."
                });
            }

            // Validate candidate
            const candidate = await Candidate.get({ id: new ObjectId(candidate_id)}) ? candidate_id: await Candidate.get({
                voting_id
            });
            if (!candidate || candidate.categoryId !== category_id) {
                return res.status(404).send({
                    success: false,
                    error: "Candidate not found or does not belong to the specified category."
                });
            }

            // Check if voting is within the allowed period
            const now = new Date();
            if (now < new Date(event.startDate) || now > new Date(event.endDate)) {
                return res.status(400).send({
                    success: false,
                    error: "Voting is not allowed outside the event's voting period."
                });
            }

            // Check for duplicate voting
            const existingVote = await Vote.get({
                voter_ip,
                event_id,
                category_id
            });

            if (existingVote) {
                return res.status(400).send({
                    success: false,
                    error: "You have already voted in this category."
                });
            }

            // Cast the vote
            const vote = await Vote.create(candidate_id, event_id, category_id, 1, voter_ip);
            const result = await vote.save();

            if (!result) {
                return res.status(500).send({
                    success: false,
                    error: "Failed to cast vote."
                });
            }

            return res.status(201).send({
                success: true,
                message: "Vote cast successfully."
            });
        } catch (error) {
            console.error("Error casting vote:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Retrieves vote statistics for an event or category.
     */
    static async getVoteStats(req, res) {
        try {
            const { event_id, category_id } = req.query;

            if (!event_id) {
                return res.status(400).send({
                    success: false,
                    error: "Missing required parameter: `event_id`."
                });
            }

            const query = { event_id };
            if (category_id) query.category_id = category_id;

            const votes = await Vote.all(query);

            if (!votes || votes.length === 0) {
                return res.status(404).send({
                    success: false,
                    error: "No votes found."
                });
            }

            const stats = votes.reduce((acc, vote) => {
                acc[vote.candidate_id] = (acc[vote.candidate_id] || 0) + vote.number_of_votes;
                return acc;
            }, {});

            return res.status(200).send({
                success: true,
                stats
            });
        } catch (error) {
            console.error("Error retrieving vote stats:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Retrieves all votes cast by a specific voter.
     */
    static async getVoterSummary(req, res) {
        try {
            const { voter_ip } = req.params;

            if (!voter_ip) {
                return res.status(400).send({
                    success: false,
                    error: "Missing required parameter: `voter_ip`."
                });
            }

            const votes = await Vote.all({ voter_ip });

            if (!votes || votes.length === 0) {
                return res.status(404).send({
                    success: false,
                    error: "No votes found for this voter."
                });
            }

            return res.status(200).send({
                success: true,
                votes
            });
        } catch (error) {
            console.error("Error retrieving voter summary:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Ends voting for a specific event or category.
     */
    static async closeVoting(req, res) {
        try {
            const { event_id, category_id } = req.body;

            if (!event_id) {
                return res.status(400).send({
                    success: false,
                    error: "Missing required field: `event_id`."
                });
            }

            const event = await Event.get({ id: new ObjectId(event_id) });
            if (!event) {
                return res.status(404).send({
                    success: false,
                    error: "Event not found."
                });
            }

            // Mark event as closed
            event.isVotingClosed = true;
            if (category_id) {
                const category = await Category.get({ id: new ObjectId(category_id) });
                if (!category || category.eventId !== event_id) {
                    return res.status(404).send({
                        success: false,
                        error: "Category not found or does not belong to the specified event."
                    });
                }

                category.isVotingClosed = true;
                await category.updateInstance({ isVotingClosed: true });
            }

            await event.updateInstance({ isVotingClosed: true });

            return res.status(200).send({
                success: true,
                message: `Voting closed for ${category_id ? "category" : "event"}.`
            });
        } catch (error) {
            console.error("Error closing voting:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }
}

export default VoteController;
