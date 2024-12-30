/**
 * Roles router
 */
import {Router} from "express";
import RoleController from "../controllers/RoleController.js";

const roleRouter = Router();

roleRouter.post("/",
 RoleController.createRole);

roleRouter.get("/", 
RoleController.listRoles);

roleRouter.put('/:roleId',
RoleController.updateRole)
roleRouter.delete('/:roleId', RoleController.deleteRole)

roleRouter.get('/:roleId', RoleController.getRole);

export default roleRouter;
