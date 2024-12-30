import { Router } from "express";
import VoteController from "../controllers/VoteController.js";
import AuthController from "../controllers/AuthController.js";

const voteRouter = Router();


voteRouter.post('/', VoteController.castVote);

voteRouter.get('/stats', AuthController.verifyToken, AuthController.verifyRole(['admin']),
 VoteController.getVoteStats);

voteRouter.get('/summary', AuthController.verifyToken, AuthController.verifyRole(['admin']),
 VoteController.getVoterSummary);

voteRouter.put('/close', AuthController.verifyToken, AuthController.verifyRole(['admin']),
VoteController.closeVoting);

export default voteRouter;