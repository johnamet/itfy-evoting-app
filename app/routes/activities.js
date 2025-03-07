import ActivityController from '../controllers/ActivityController.js';
import { Router } from 'express';
import AuthController from '../controllers/AuthController.js';
const activityRouter = Router();

activityRouter.get('/', AuthController.verifyToken, ActivityController.activities);
activityRouter.get('/sites', ActivityController.siteVisits);
activityRouter.post('/sites', ActivityController.postSiteVisit);

export default activityRouter;