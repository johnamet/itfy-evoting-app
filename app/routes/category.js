/**
 * Category endpoint
 */

import AuthController from "../controllers/AuthController.js";
import CategoryController from "../controllers/CategoryController.js";
import { Router } from "express";

const catRouter = Router();


catRouter.post('/', AuthController.verifyToken, 
    AuthController.verifyRole(['admin', 'superuser']),
 CategoryController.createCategory);

catRouter.get('/', AuthController.verifyToken, 
    AuthController.verifyRole(['admin', 'superuser']), 
 CategoryController.listCategories);


catRouter.put('/:categoryId', AuthController.verifyToken,
     AuthController.verifyRole(["admin", "superuser"]),
CategoryController.updateCategory);

catRouter.delete('/:categoryId', AuthController.verifyToken, 
    AuthController.verifyRole(["admin", "superuser"]), 
);

catRouter.get('/:categoryId', AuthController.verifyToken, AuthController.verifyRole(['admin']),
CategoryController.getCategoryDetails);


export default catRouter;

