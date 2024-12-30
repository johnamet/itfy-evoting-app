/**
 * Event endpoints
 */


import {Router} from "express";
import EventController from "../controllers/EventController.js";
import AuthController from "../controllers/AuthController.js";

const eventRouter = Router();


eventRouter.get('/', EventController.listEvents);
eventRouter.post('/',AuthController.verifyToken,
     AuthController.verifyRole(['admin']), EventController.createEvent);
eventRouter.delete('/:eventId',AuthController.verifyToken,
     AuthController.verifyRole(['admin']), EventController.deleteEvent);
eventRouter.put('/:eventId', AuthController.verifyToken,
     AuthController.verifyRole(['admin']), EventController.updateEvent);
eventRouter.get('/:eventId', EventController.getEventDetails);

export default  eventRouter;