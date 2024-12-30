import { Router } from "express";
import AppController from "../controllers/AppController";


const appRouter = Router();


appRouter.get('/status', AppController.getStatus);
appRouter.get('/stats', AppController.getStats);

appRouter.post('/files/upload', AppController.uploadFile);
appRouter.get('/files', AppController.getFiles)
appRouter.get('/files/download', AppController.downloadFile);

export default appRouter;