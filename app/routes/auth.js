import AuthController from "../controllers/AuthController.js";
import {Router} from "express";


const authRouter = Router();
authRouter.post('/login', AuthController.login);
authRouter.post('/logout', AuthController.verifyToken,
    AuthController.logout);


export default authRouter;