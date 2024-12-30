import routes from "./index.js";
import UserController from "../controllers/UserController.js";
import AuthController from "../controllers/AuthController.js";
import {Router} from "express";

/**
 * The users route for user management
 */

const userRouter = Router()

userRouter.post('/', UserController.createUser);
userRouter.put('/:userId', AuthController.verifyToken,
    UserController.updateUser);
userRouter.get('/', AuthController.verifyToken,
    AuthController.verifyRole(['admin']),
    UserController.listUsers);

userRouter.get('/me/:userId', AuthController.verifyToken, UserController.myProfile);


userRouter.delete('/:userId', AuthController.verifyToken,
    AuthController.verifyRole(['admin']),
    UserController.deleteUser);

export default userRouter;