/**
 * Roles router
 */
import {Router} from "express";
import RoleController from "../controllers/RoleController.js";


const roleRouter = Router();

roleRouter.post("/create-role", RoleController.createRole);
roleRouter.get("/roles", RoleController.listRoles);
roleRouter.put('/update/:roleId', RoleController.updateRole)

export default roleRouter;
