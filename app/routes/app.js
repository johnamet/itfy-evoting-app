import { Router } from "express";
import AppController from "../controllers/AppController.js";


const appRouter = Router();


appRouter.get('/status', AppController.getStatus);
appRouter.get('/stats', AppController.getStats);

appRouter.post('/files/', AppController.uploadFile);
appRouter.get('/files/:categoryId/:entityId', AppController.getFiles)
appRouter.get('/files/:categoryId/:entityId/:fileName/open', AppController.openFile);
appRouter.get('/files/:categoryId/:entityId/:fileName', AppController.downloadFile);
export default appRouter;
