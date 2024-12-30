/**
 * The router
 */
import {Router} from "express";
import AppController from "../controllers/AppController.js";
import authRouter from "./auth.js";
import userController from "../controllers/UserController.js";
import roleRouter from "./roles.js";
import userRouter from "./users.js";



const router = Router()


router.use('/auth', authRouter);
router.use('/users', userRouter);
router.use('roles', roleRouter)

router.get('/status', AppController.getStatus);
router.get('/stats', AppController.getStats);



export default  router;