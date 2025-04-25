import Router from "express";
import AuthController from "../controllers/AuthController.js";
import VoteBundleController from "../controllers/VoteBundleController.js";


const voteBundleRouter = Router();

voteBundleRouter.get('/',
    VoteBundleController.listVoteBundles);

voteBundleRouter.get('/:id',
    VoteBundleController.getVoteBundle);

voteBundleRouter.post('/', AuthController.verifyToken, AuthController.verifyRole(['admin']),
    VoteBundleController.createVoteBundle);
voteBundleRouter.put('/:id', AuthController.verifyToken, AuthController.verifyRole(['admin']),
    VoteBundleController.updateVoteBundle);

voteBundleRouter.delete('/:id', AuthController.verifyToken, AuthController.verifyRole(['admin']),
    VoteBundleController.deleteVoteBundle);

export default voteBundleRouter;