import { Router } from "express";
import VoteController from "../controllers/VoteController.js";
import AuthController from "../controllers/AuthController.js";
import VoteBundleController from "../controllers/VoteBundleController.js";
const voteRouter = Router();


voteRouter.post('/', VoteController.castVote);
voteRouter.post('/vote', VoteController.manualVoteFromPayment);
voteRouter.get('/stats', AuthController.verifyToken, AuthController.verifyRole(['admin']),
 VoteController.voteStats);
 voteRouter.get('/summary', AuthController.verifyToken, AuthController.verifyRole(['admin']),
 VoteController.voteSummary);
 voteRouter.get('/:event_id', VoteController.getAllVotes);
    

export default voteRouter;
