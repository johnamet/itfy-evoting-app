import User from "../models/user.js";
import Role from "../models/role.js";
import jwt from "jsonwebtoken";
import {configDotenv} from "dotenv";
import {ObjectId} from "mongodb";
import {cacheEngine} from "../utils/engine/CacheEngine.js";

configDotenv();
class AuthController {
    /**
     * Logs in a user
     */
    static async login(req, res) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).send({
                    success: false,
                    error: "Missing required fields: `email` or `password`"
                });
            }

            const userRecord = await User.get({email});

            if (!userRecord) {
                return res.status(404).send({
                    success: false,
                    error: `User with email: ${email} not found`
                });
            }

            const user = User.from_object(userRecord);

            const checkPassword = await user.verifyPassword(password);

            if (!checkPassword) {
                return res.status(400).send({
                    success: false,
                    error: "Password mismatched."
                });
            }

            const role = user.roleId ? await Role.get({id: new ObjectId(user.roleId)})['name'] : null;
            const payload = {
                userId: user.id,
                role,
                iat: Math.floor(Date.now() / 1000)
            };

            const accessToken = jwt.sign(payload, process.env["SECRET_KEY"], {
                expiresIn: "1h"
            });

            return res.status(200).send({
                success: true,
                accessToken
            });
        } catch (error) {
            console.error("Login error:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Logs out a user by blacklisting the access token
     */
    static async logout(req, res) {
        try {
            const authHeader = req.headers["authorization"];
            const accessToken = authHeader && authHeader.split(" ")[1];

            if (!accessToken) {
                return res.status(401).send({
                    success: false,
                    error: "Missing authorization header"
                });
            }

            jwt.verify(accessToken, process.env["SECRET_KEY"], async (err) => {
                if (err) {
                    return res.status(403).send({
                        success: false,
                        error: "Invalid or expired token"
                    });
                }

                await cacheEngine.set(`blacklisted-${accessToken}`, true, 3600); // Blacklist for 1 hour
                return res.status(200).send({
                    success: true,
                    message: "User logged out successfully"
                });
            });
        } catch (error) {
            console.error("Logout error:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Middleware to verify and validate the token
     */
    static async verifyToken(req, res, next) {
        try {
            const authHeader = req.headers["authorization"];
            const accessToken = authHeader && authHeader.split(" ")[1];

            if (!accessToken) {
                return res.status(401).send({
                    success: false,
                    error: "Missing authorization header"
                });
            }

            console.log("Checking blacklist")

            const isBlacklisted = await cacheEngine.get(`blacklisted-${accessToken}`);

            // if (isBlacklisted) {
            //     return res.status(403).send({
            //         success: false,
            //         error: "Token has been revoked"
            //     });
            // }

            console.log("Verifying accesstoken");

            jwt.verify(accessToken, process.env["SECRET_KEY"], (err, decoded) => {
                if (err) {
                    return res.status(403).send({
                        success: false,
                        error: "Invalid or expired token"
                    });
                }

                req.user = decoded; // Attach decoded token to the request
                next();
            });
        } catch (error) {
            console.error("Token verification error:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Middleware to verify roles for RBAC
     * @param {Array<string>} allowedRoles - Array of allowed roles
     */
    static verifyRole(allowedRoles) {
        return async (req, res, next) => {
            try {
                const { user } = req;
                if (!user || !user.role || !allowedRoles.includes(user.role.name)) {
                    return res.status(403).send({
                        success: false,
                        error: "Access denied: insufficient permissions"
                    });
                }
                next();
            } catch (error) {
                console.error("Role verification error:", error);
                return res.status(500).send({
                    success: false,
                    error: error.message
                });
            }
        };
    }
}

export default AuthController;
