import { Router } from "express";
import VoteController from "../controllers/VoteController.js";
import AuthController from "../controllers/AuthController.js";

const voteRouter = Router();


voteRouter.post('/', VoteController.castVote);

voteRouter.get('/stats', AuthController.verifyToken, AuthController.verifyRole(['admin']),
 VoteController.getVoteStats);

voteRouter.get('/summary',
 VoteController.getVoteSummary);

voteRouter.get('/:candidate_id', VoteController.liveVoteUpdates);




export default voteRouter;