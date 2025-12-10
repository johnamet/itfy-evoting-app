#!/usr/bin/env node
/**
 * Enhanced Role Model for ITFY E-Voting System
 *
 * @module Role
 * @version 2.0.0
 */

import mongoose from "mongoose";
import BaseModel from "./BaseModel.js";

const RoleSchema = {
  // Basic Info
  name: {
    type: String,
    required: [true, "Role name is required"],
    unique: true,
    trim: true,
  },

  level: {
    type: Number,
    required: [true, "Role level is required"],
    min: 1,
    max: 4,
    unique: true,
  },

  description: {
    type: String,
    trim: true,
  },

  // Permissions Array
  permissions: [
    {
      type: String,
      trim: true,
    },
  ],

  // Role Inheritance
  inherits: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Role",
    default: null,
  },

  // System Role Flag
  isSystem: {
    type: Boolean,
    default: false,
  },

  // Status
  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active",
  },
};

// Create Role model using BaseModel
const roleModel = new BaseModel(RoleSchema, {
  collection: "roles",
  timestamps: true,
});

// Add Indexes
roleModel.addUniqueIndex({ name: 1 });
roleModel.addUniqueIndex({ level: 1 });
roleModel.addIndex({ isSystem: 1 });
roleModel.addIndex({ status: 1 });

// Virtuals

/**
 * Get all permissions including inherited
 */
roleModel.addVirtual("allPermissions", async function () {
  const permissions = new Set(this.permissions);

  // Get inherited permissions
  if (this.inherits) {
    const parentRole = await this.constructor.findById(this.inherits);
    if (parentRole) {
      const parentPerms = await parentRole.allPermissions;
      parentPerms.forEach((perm) => permissions.add(perm));
    }
  }

  return Array.from(permissions);
});

/**
 * Get full hierarchy path
 */
roleModel.addVirtual("hierarchy", async function () {
  const path = [this.name];

  if (this.inherits) {
    const parentRole = await this.constructor.findById(this.inherits);
    if (parentRole) {
      const parentHierarchy = await parentRole.hierarchy;
      path.push(...parentHierarchy);
    }
  }

  return path;
});

// Instance Methods

/**
 * Check if role has specific permission
 */
roleModel.addInstanceMethod("hasPermission", async function (permission) {
  // Check direct permissions
  if (this.permissions.includes(permission)) {
    return true;
  }

  // Check inherited permissions
  if (this.inherits) {
    const parentRole = await this.constructor.findById(this.inherits);
    if (parentRole) {
      return await parentRole.hasPermission(permission);
    }
  }

  return false;
});

/**
 * Get all permissions including inherited
 */
roleModel.addInstanceMethod("getAllPermissions", async function () {
  const permissions = new Set(this.permissions);

  // Get inherited permissions recursively
  if (this.inherits) {
    const parentRole = await this.constructor.findById(this.inherits).lean();
    if (parentRole) {
      const ParentRoleModel = this.constructor;
      const parentInstance = new ParentRoleModel(parentRole);
      const parentPerms = await parentInstance.getAllPermissions();
      parentPerms.forEach((perm) => permissions.add(perm));
    }
  }

  return Array.from(permissions);
});

/**
 * Check if can access resource
 */
roleModel.addInstanceMethod("canAccess", async function (resource, action) {
  const permission = `${resource}.${action}`;
  return await this.hasPermission(permission);
});

/**
 * Add permission
 */
roleModel.addInstanceMethod("addPermission", async function (permission) {
  if (!this.permissions.includes(permission)) {
    this.permissions.push(permission);
    return await this.save();
  }
  return this;
});

/**
 * Remove permission
 */
roleModel.addInstanceMethod("removePermission", async function (permission) {
  this.permissions = this.permissions.filter((p) => p !== permission);
  return await this.save();
});

// Static Methods

/**
 * Find by level
 */
roleModel.addStaticMethod("findByLevel", async function (level) {
  return await this.findOne({ level, deleted: false });
});

/**
 * Get role hierarchy tree
 */
roleModel.addStaticMethod("getHierarchy", async function () {
  const roles = await this.find({ deleted: false }).sort({ level: 1 }).populate("inherits");

  const buildTree = (role) => {
    return {
      id: role._id,
      name: role.name,
      level: role.level,
      permissions: role.permissions,
      children: roles.filter((r) => r.inherits && r.inherits._id.equals(role._id)).map(buildTree),
    };
  };

  // Find root roles (no inheritance)
  const rootRoles = roles.filter((r) => !r.inherits);
  return rootRoles.map(buildTree);
});

/**
 * Validate permission format
 */
roleModel.addStaticMethod("validatePermission", function (permission) {
  const regex = /^[a-z]+\.(create|read|update|delete|manage|\*)$/;
  return regex.test(permission);
});

/**
 * Get all available permissions
 */
roleModel.addStaticMethod("getAvailablePermissions", function () {
  return [
    // User permissions
    "users.create",
    "users.read",
    "users.update",
    "users.delete",
    "users.manage",

    // Event permissions
    "events.create",
    "events.read",
    "events.update",
    "events.delete",
    "events.manage",

    // Candidate permissions
    "candidates.create",
    "candidates.read",
    "candidates.update",
    "candidates.delete",
    "candidates.manage",

    // Vote permissions
    "votes.create",
    "votes.read",
    "votes.update",
    "votes.delete",
    "votes.manage",

    // Payment permissions
    "payments.read",
    "payments.manage",

    // Analytics permissions
    "analytics.read",
    "analytics.manage",

    // System permissions
    "system.settings",
    "system.manage",

    // Wildcard
    "*.*",
  ];
});

/**
 * Create default roles
 */
roleModel.addStaticMethod("createDefaults", async function () {
  const defaults = [
    {
      name: "voter",
      level: 1,
      description: "Regular voter with basic permissions",
      permissions: ["events.read", "candidates.read", "votes.create"],
      isSystem: true,
    },
    {
      name: "candidate",
      level: 2,
      description: "Candidate with profile management permissions",
      permissions: ["events.read", "candidates.read", "candidates.update"],
      isSystem: true,
    },
    {
      name: "event_manager",
      level: 3,
      description: "Event manager with full event management permissions",
      permissions: [
        "events.*",
        "candidates.*",
        "categories.*",
        "votes.read",
        "votes.manage",
        "analytics.read",
      ],
      isSystem: true,
    },
    {
      name: "admin",
      level: 4,
      description: "Administrator with full system access",
      permissions: ["*.*"],
      isSystem: true,
    },
  ];

  const created = [];
  for (const roleData of defaults) {
    const exists = await this.findOne({ name: roleData.name });
    if (!exists) {
      const role = await this.create(roleData);
      created.push(role);
    }
  }

  return created;
});

// Middleware

// Prevent deletion of system roles
roleModel.addPreHook("remove", function (next) {
  if (this.isSystem) {
    return next(new Error("Cannot delete system role"));
  }
  next();
});

// Prevent deletion of system roles via deleteOne
roleModel.addPreHook("deleteOne", function (next) {
  if (this.isSystem) {
    return next(new Error("Cannot delete system role"));
  }
  next();
});

// Validate permissions before saving
roleModel.addPreHook("save", function (next) {
  // Validate each permission
  const invalidPermissions = this.permissions.filter(
    (perm) => !perm.includes(".") && perm !== "*.*"
  );

  if (invalidPermissions.length > 0) {
    return next(
      new Error(`Invalid permission format: ${invalidPermissions.join(", ")}`)
    );
  }

  next();
});

// Create and export model
const Role = roleModel.getModel("Role");

export default Role;
