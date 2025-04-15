/**
 * The router
 */
import { Router } from "express";
import AppController from "../controllers/AppController.js";
import authRouter from "./auth.js";
import userController from "../controllers/UserController.js";
import roleRouter from "./roles.js";
import userRouter from "./users.js";
import catRouter from "./category.js";
import AuthController from "../controllers/AuthController.js";
import eventRouter from "./events.js";
import voteRouter from "./votes.js";
import nominationRouter from "./nominations.js";
import candidateRouter from "./candidates.js";
import activityRouter from "./activities.js";
import appRouter from "./app.js";
import slideRouter from "./slides.js";



const router = Router()


router.use('/auth', authRouter);
router.use('/users', userRouter);
router.use('/roles', AuthController.verifyToken,
     AuthController.verifyRole(['admin']),
     roleRouter);
router.use('/categories', catRouter);
router.use('/events',
     eventRouter);
router.use('/votes', voteRouter);
router.use('/nominations', nominationRouter);
router.use('/candidates', candidateRouter);
router.use('/app', appRouter)
router.use('/activities', activityRouter);
router.use('/slides', slideRouter);




export default router;