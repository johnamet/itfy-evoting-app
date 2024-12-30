import routes from "./index.js";
import UserController from "../controllers/UserController.js";
import AuthController from "../controllers/AuthController.js";
import {Router} from "express";

/**
 * The users route for user management
 */

const userRouter = Router()

userRouter.post('/create-user', UserController.createUser);
userRouter.put('/update-user/:userId',
    UserController.updateUser);
userRouter.get('/', AuthController.verifyToken,
    AuthController.verifyRole(['admin']),
    UserController.listUsers);

userRouter.get('/me/:userId', UserController.myProfile);


userRouter.delete('/users/delete-user', AuthController.verifyToken,
    AuthController.verifyRole(['admin']),
    UserController.deleteUser);

export default userRouter;
