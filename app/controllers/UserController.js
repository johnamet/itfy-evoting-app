import User from "../models/user.js";

class UserController {
    /**
     * Creates a new user.
     */
    static async createUser(req, res) {
        try {
            const { name, email, password } = req.body;

            if (!name || !email || !password) {
                return res.status(400).send({
                    success: false,
                    error: "Missing required fields: `name`, `email`, or `password`."
                });
            }

            const existingUser = await User.get({email: email});

            if (existingUser){
                return res.status(400).send({
                    error: `User with ${email} already exists.`,
                    success: false
                });
            }

            const user = new User(name, email, password);
            const result = await user.save();

            if (!result) {
                return res.status(500).send({
                    success: false,
                    error: "Failed to create user."
                });
            }

            return res.status(201).send({
                success: true,
                user: user.to_object()
            });
        } catch (error) {
            console.error("Error creating user:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Updates an existing user.
     */
    static async updateUser(req, res) {
        try {
            const { userId } = req.params;
            const body = req.body;

            if (!userId) {
                return res.status(400).send({
                    success: false,
                    error: "Missing required parameter: `userId`."
                });
            }

            if (!body) {
                return res.status(400).send({
                    success: false,
                    error: "Missing request body."
                });
            }

            let user = await User.get({ id: userId });
            if (!user) {
                return res.status(404).send({
                    success: false,
                    error: `User with ID ${userId} not found.`
                });
            }

            user = User.from_object(user);
            const result = await user.updateInstance(body);

            if (!result) {
                return res.status(500).send({
                    success: false,
                    error: "Failed to update user."
                });
            }

            return res.status(200).send({
                success: true,
                user: user.to_object()
            });
        } catch (error) {
            console.error("Error updating user:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Deletes a user.
     */
    static async deleteUser(req, res) {
        try {
            const { userId } = req.params;

            if (!userId) {
                return res.status(400).send({
                    success: false,
                    error: "Missing required parameter: `userId`."
                });
            }

            const result = await User.delete({ id: userId });

            if (!result) {
                return res.status(404).send({
                    success: false,
                    error: `User with ID ${userId} not found or could not be deleted.`
                });
            }

            return res.status(200).send({
                success: true,
                message: `User with ID ${userId} successfully deleted.`
            });
        } catch (error) {
            console.error("Error deleting user:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Lists all users or users matching query parameters.
     */
    static async listUsers(req, res) {
        try {
            const query = req.query || {};
            const users = await User.query(query);

            if (!users || users.length === 0) {
                return res.status(404).send({
                    success: false,
                    error: "No users found matching the given criteria."
                });
            }

            return res.status(200).send({
                success: true,
                users: users.map(user => User.from_object(user).to_object())
            });
        } catch (error) {
            console.error("Error listing users:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }
}

export default UserController;
