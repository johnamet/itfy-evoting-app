#!/usr/bin/node

/**
 * UserController handles user-related operations.
 * It includes methods for creating, updating, deleting, and listing users, as well as retrieving user profiles.
 */

import User from "../models/user.js";
import { ObjectId } from "mongodb";
import generateStrongPassword from "../utils/passwordGenerator.js";
import sendEmail, { generateTemporaryPasswordResetTemplate,  generatePasswordResetTemplate } from "../utils/emailSender.js";
import Role from "../models/role.js";
import { generateWelcomeEmail } from "../utils/emailSender.js";

class UserController {
  /**
   * Creates a new user.
   * @param {Request} req - The request object containing user details.
   * @param {Response} res - The response object.
   */
  static async createUser(req, res) {
    try {
      let strongPassword = null;
      const data = req.body;

      if (!data) {
        return res.status(400).send({
          error: "Missing data",
          success: false
        });
      }
      const { name, email, password } = data;

      if (!name || !email ) {
        return res.status(400).send({
          success: false,
          error: "Missing required fields: `name`, `email`, or `password`."
        });
      }

      const existingUser = await User.get({ email: email });

      if (existingUser) {
        return res.status(400).send({
          error: `User with ${email} already exists.`,
          success: false
        });
      }

      if (!password){
        strongPassword = generateStrongPassword();
      }else{
        strongPassword = password;
      }

      let role = data.role ? data.role : "admin";

      role = await Role.get({ name: role });

      if (!role) {
        role = new Role("admin", "Admin role");
        await role.save();
      }

      const user = await User.create(name, email, strongPassword, {roleId: role.id});
      const result = await user.save();
      await sendEmail(email, "Your Password", generateWelcomeEmail(email, strongPassword, role.name));


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
   * @param {Request} req - The request object containing user ID and update details.
   * @param {Response} res - The response object.
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

      let user = await User.get({ id: new ObjectId(userId) });
      if (!user) {
        return res.status(404).send({
          success: false,
          error: `User with ID ${userId} not found.`
        });
      }

      user = User.from_object(user);
      const result = await user.updateInstance(body);

      console.log("result", result);
      if (!result) {
        return res.status(400).send({
          success: false,
          error: "Failed to update user."
        });
      }

      return res.status(200).send({
        success: true,
        user: await User.get({ id: user.id }).then(user => {
          if (user) {
            delete user.password;
          }
          return user;
        })
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
   * @param {Request} req - The request object containing user ID.
   * @param {Response} res - The response object.
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

      let user = User.get({id: new ObjectId(userId)});
      if (!user) {
        return res.status(404).send({
          success: false,
          error: `User with ID ${userId} not found.`
        });
      }

      user = User.from_object(user);
      user.delete();

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
   * @param {Request} req - The request object containing query parameters.
   * @param {Response} res - The response object.
   */
  static async listUsers(req, res) {
    try {
      const query = req.query || {};
      const users = await User.all(query);

      if (!users || users.length === 0) {
        return res.status(404).send({
          success: false,
          error: "No users found matching the given criteria."
        });
      }

      return res.status(200).send({
        success: true,
        users: users.map(user => {
          user = User.from_object(user).to_object();
          delete user.password;
          return user;
        })
      });
    } catch (error) {
      console.error("Error listing users:", error);
      return res.status(500).send({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Retrieves the profile of a specific user.
   * @param {Request} req - The request object containing user ID.
   * @param {Response} res - The response object.
   */
  static async myProfile(req, res) {
    try {
      const { userId } = req.params;

      // Check for the user with id
      const userRecord = await User.get({ id: new ObjectId(userId) });

      if (!userRecord) {
        return res.status(400).send({
          error: `User with id: ${userId} not found.`,
          success: false
        });
      }

      delete userRecord['password'];

      return res.status(200).send({
        success: true,
        user: userRecord
      });
    } catch (e) {
      console.error(e);

      return res.status(500).send({
        success: false,
        error: e.message
      });
    }
  }

  /**
   * Resets the password of a user.
   * @param {Request} req - The request object containing user ID and new password.
   * @param {Response} res - The response object.
   */
  static async resetPassword(req, res) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).send({
          success: false,
          error: "Missing required parameters: `userId``."
        });
      }

      let user = await User.get({ id: new ObjectId(userId) });
      if (!user) {
        return res.status(404).send({
          success: false,
          error: `User with ID ${userId} not found.`
        });
      }

      user = User.from_object(user);
      const password = generateStrongPassword(10)
      user.password = password;
      const result = await user.updateInstance({ password: user.password });

      if (!result) {
        return res.status(500).send({
          success: false,
          error: "Failed to reset password."
        });
      }

      await sendEmail(user.email, "PASSWORD RESET", generateTemporaryPasswordResetTemplate(user.email, password) )

      return res.status(200).send({
        success: true,
        message: "Password reset successfully."
      });
    } catch (error) {
      console.error("Error resetting password:", error);
      return res.status(500).send({
        success: false,
        error: error.message
      });
    }
  }

	/**
 * Change the password of a user.
 * @param {Request} req - The request object containing user ID and new password.
 * @param {Response} res - The response object.
 */

static async changePassword(req, res) {
    try {
        const { currentPassword, newPassword } = req.body;
        const { userId } = req.params;

        // Validate userId
        if (!userId) {
            return res.status(400).send({
                success: false,
                error: "Please provide the user ID.",
            });
        }

        // Fetch user from DB
        const fetchedUser = await User.get({ id: new ObjectId(userId) });

        if (!fetchedUser) {
            return res.status(404).send({
                success: false,
                error: `User with ID: ${userId} not found.`,
            });
        }

        const user = User.from_object(fetchedUser);

        // Validate current password
        if (!currentPassword) {
            return res.status(400).send({
                success: false,
                error: "Missing current password.",
            });
        }

        // Verify password
        const isPasswordValid = await user.verifyPassword(currentPassword);

        if (!isPasswordValid) {
            return res.status(400).send({
                success: false,
                error: "Incorrect current password.",
            });
        }

        // Validate new password
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).send({
                success: false,
                error: "New password must be at least 6 characters long.",
            });
        }

        // Update password
	console.log(newPassword)
        user.password = newPassword;
        const result = await user.updateInstance({ password: user.password });

        if (!result) {
            return res.status(500).send({
                success: false,
                error: "Failed to update password due to an internal error.",
            });
        }

        // Send confirmation email
        await sendEmail(
            user.email,
            "PASSWORD RESET",
             generatePasswordResetTemplate(user.email, newPassword)
        );

        return res.status(200).send({
            success: true,
            message: "Password reset successfully.",
        });
    } catch (error) {
        console.error("Error in changePassword:", error);
        return res.status(500).send({
            success: false,
            error: "An unexpected error occurred.",
        });
    }
}

}

export default UserController;
