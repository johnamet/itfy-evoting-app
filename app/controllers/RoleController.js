import Role from "../models/role.js";

class RoleController {
    /**
     * Create a new role.
     */
    static async createRole(req, res) {
        try {
            const { name, description } = req.body;

            if (!name || !description) {
                return res.status(400).send({
                    error: "Missing required fields `name` or `description`",
                    success: false,
                });
            }

            //check if role with name exists

            const roleRecord = await Role.get({name: name.toLowerCase()});

            if (roleRecord){
                return res.status(403).send({
                    error: `Role with name ${name} exists`,
                    success: false
                });
            }

            const role = new Role(name, description);
            const result = await role.save();

            if (!result) {
                return res.status(500).send({
                    success: false,
                    error: "Failed to create a new role",
                });
            }

            return res.status(201).send({
                success: true,
                role: role.to_object(),
            });
        } catch (e) {
            console.error(e);
            return res.status(500).send({
                error: e.message,
                success: false,
            });
        }
    }

    /**
     * List all roles or filter roles based on query parameters.
     */
    static async listRoles(req, res) {
        try {
            const query = req.query || {};
            const roles = await Role.all(query);

            return res.status(200).send({
                success: true,
                roles,
            });
        } catch (e) {
            console.error(e);
            return res.status(500).send({
                error: e.message,
                success: false,
            });
        }
    }

    /**
     * Update an existing role.
     */
    static async updateRole(req, res) {
        try {
            const { roleId } = req.params;
            const updates = req.body;

            if (!roleId) {
                return res.status(400).send({
                    error: "Missing `roleId` parameter",
                    success: false,
                });
            }

            if (!updates || Object.keys(updates).length === 0) {
                return res.status(400).send({
                    error: "Missing fields to update",
                    success: false,
                });
            }

            let role = await Role.get({ id: roleId });

            if (!role) {
                return res.status(404).send({
                    error: `Role with id: ${roleId} not found`,
                    success: false,
                });
            }

            role = Role.from_object(role);

            await role.updateInstance(updates);

            return res.status(200).send({
                success: true,
                role: role.to_object(),
            });
        } catch (e) {
            console.error(e);
            return res.status(500).send({
                error: e.message,
                success: false,
            });
        }
    }
}

export default RoleController;
