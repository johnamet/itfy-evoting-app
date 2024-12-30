/**
 * Event endpoints
 */


import {Router} from "express";
import NominationController from "../controllers/NominationController.js";
import AuthController from "../controllers/AuthController.js";

const nominationRouter = Router();


nominationRouter.get('/', AuthController.verifyToken, AuthController.verifyRole(['admin']),
 NominationController.listNominations);

nominationRouter.post('/', NominationController.createNomination);
nominationRouter.delete('/:nominationId', AuthController.verifyToken,
     AuthController.verifyRole(['admin']),
NominationController.deleteNomination);
nominationRouter.put('/:nominationId', AuthController.verifyToken, 
    AuthController.verifyRole(['admin']),
 NominationController.updateNomination);
nominationRouter.get('/:nominationId', AuthController.verifyToken,
    AuthController.verifyRole(['admin']),
 NominationController.getNominationDetails);


export default nominationRouter;