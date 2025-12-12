#!/usr/bin/env node
/**
 * Enhanced Base Model for ITFY E-Voting System
 *
 * Provides common functionality for all models including:
 * - Automatic timestamps
 * - Soft delete support
 * - Audit trail tracking
 * - Pagination helpers
 * - Common virtuals and methods
 * - Plugin integration
 *
 * @module BaseModel
 * @version 2.0.0
 */

import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";
import mongooseDelete from "mongoose-delete";
import aggregatePaginate from "mongoose-aggregate-paginate-v2";

/**
 * Base Model Class
 * Abstract class that all models should extend
 */
class BaseModel {
  constructor(schemaDefinition, options = {}) {
    // Removed abstract class check to allow direct instantiation
    this.schemaDefinition = schemaDefinition;
    this.options = {
      timestamps: true, // Automatic createdAt and updatedAt
      collection: options.collection || undefined,
      toJSON: {
        virtuals: true,
        transform: this._jsonTransform,
      },
      toObject: {
        virtuals: true,
        transform: this._objectTransform,
      },
      ...options,
    };

    // Build the complete schema with base fields
    const completeSchema = this._buildCompleteSchema();

    // Create the Mongoose schema
    this.schema = new mongoose.Schema(completeSchema, this.options);

    // Apply plugins
    this._applyPlugins();

    // Add common indexes
    this._addCommonIndexes();

    // Add common virtuals
    this._addCommonVirtuals();

    // Add common instance methods
    this._addCommonInstanceMethods();

    // Add common static methods
    this._addCommonStaticMethods();

    // Add common middleware
    this._addCommonMiddleware();
  }

  /**
   * Build complete schema with base fields
   * @private
   */
  _buildCompleteSchema() {
    return {
      ...this.schemaDefinition,

      // Audit trail fields (who created/updated)
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: false,
      },
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: false,
      },

      // Schema version for migrations
      schemaVersion: {
        type: Number,
        default: 1,
        select: false,
      },

      // Metadata for flexible data storage
      metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
        select: false,
      },
    };
  }

  /**
   * Apply common plugins
   * @private
   */
  _applyPlugins() {
    // Pagination plugin
    this.schema.plugin(mongoosePaginate);

    // Aggregate pagination plugin
    this.schema.plugin(aggregatePaginate);

    // Soft delete plugin (adds deleted, deletedAt, deletedBy fields)
    this.schema.plugin(mongooseDelete, {
      deletedAt: true,
      deletedBy: true,
      overrideMethods: true,
      indexFields: ["deleted"],
    });
  }

  /**
   * Add common indexes
   * @private
   */
  _addCommonIndexes() {
    // Index for timestamps (useful for sorting)
    this.schema.index({ createdAt: -1 });
    this.schema.index({ updatedAt: -1 });

    // Index for soft delete
    this.schema.index({ deleted: 1 });

    // Compound index for audit trail
    this.schema.index({ createdBy: 1, createdAt: -1 });
  }

  /**
   * Add common virtual properties
   * @private
   */
  _addCommonVirtuals() {
    // Virtual for document ID as string
    this.schema.virtual("id").get(function () {
      return this._id.toHexString();
    });

    // Virtual for checking if document is new
    this.schema.virtual("isNew").get(function () {
      return this._id === undefined;
    });

    // Virtual for document age
    this.schema.virtual("age").get(function () {
      if (!this.createdAt) return null;
      return Date.now() - this.createdAt.getTime();
    });

    // Virtual for last modified duration
    this.schema.virtual("lastModified").get(function () {
      if (!this.updatedAt) return null;
      return Date.now() - this.updatedAt.getTime();
    });

    // Virtual for checking if document was modified
    this.schema.virtual("wasModified").get(function () {
      if (!this.createdAt || !this.updatedAt) return false;
      return this.updatedAt.getTime() > this.createdAt.getTime();
    });
  }

  /**
   * Add common instance methods
   * @private
   */
  _addCommonInstanceMethods() {
    /**
     * Soft delete the document
     */
    this.schema.methods.softDelete = async function (deletedBy = null) {
      this.deleted = true;
      this.deletedAt = new Date();
      if (deletedBy) {
        this.deletedBy = deletedBy;
      }
      return await this.save();
    };

    /**
     * Restore soft deleted document
     */
    this.schema.methods.restore = async function () {
      this.deleted = false;
      this.deletedAt = undefined;
      this.deletedBy = undefined;
      return await this.save();
    };

    /**
     * Update metadata
     */
    this.schema.methods.setMetadata = async function (key, value) {
      if (!this.metadata) {
        this.metadata = {};
      }
      this.metadata[key] = value;
      this.markModified("metadata");
      return await this.save();
    };

    /**
     * Get metadata value
     */
    this.schema.methods.getMetadata = function (key, defaultValue = null) {
      if (!this.metadata || !this.metadata[key]) {
        return defaultValue;
      }
      return this.metadata[key];
    };

    /**
     * Check if document was created by user
     */
    this.schema.methods.wasCreatedBy = function (userId) {
      if (!this.createdBy) return false;
      return this.createdBy.toString() === userId.toString();
    };

    /**
     * Check if document was updated by user
     */
    this.schema.methods.wasUpdatedBy = function (userId) {
      if (!this.updatedBy) return false;
      return this.updatedBy.toString() === userId.toString();
    };

    /**
     * Get audit trail
     */
    this.schema.methods.getAuditTrail = function () {
      return {
        createdBy: this.createdBy,
        createdAt: this.createdAt,
        updatedBy: this.updatedBy,
        updatedAt: this.updatedAt,
        deletedBy: this.deletedBy,
        deletedAt: this.deletedAt,
        deleted: this.deleted,
      };
    };

    /**
     * Clone document (create copy without _id)
     */
    this.schema.methods.clone = function () {
      const obj = this.toObject();
      delete obj._id;
      delete obj.__v;
      delete obj.createdAt;
      delete obj.updatedAt;
      delete obj.createdBy;
      delete obj.updatedBy;
      return new this.constructor(obj);
    };
  }

  /**
   * Add common static methods
   * @private
   */
  _addCommonStaticMethods() {
    /**
     * Find documents with pagination
     */
    this.schema.statics.findPaginated = async function (
      query = {},
      options = {}
    ) {
      const {
        page = 1,
        limit = 10,
        sort = { createdAt: -1 },
        populate = [],
        select = null,
      } = options;

      return await this.paginate(query, {
        page,
        limit,
        sort,
        populate,
        select,
        lean: false,
      });
    };

    /**
     * Find active documents (not soft deleted)
     */
    this.schema.statics.findActive = function (query = {}, options = {}) {
      return this.find({ ...query, deleted: false }, null, options);
    };

    /**
     * Find deleted documents
     */
    this.schema.statics.findDeleted = function (query = {}, options = {}) {
      return this.findDeleted(query, options);
    };

    /**
     * Count active documents
     */
    this.schema.statics.countActive = function (query = {}) {
      return this.countDocuments({ ...query, deleted: false });
    };

    /**
     * Count deleted documents
     */
    this.schema.statics.countDeleted = function (query = {}) {
      return this.countDocuments({ ...query, deleted: true });
    };

    /**
     * Bulk soft delete
     */
    this.schema.statics.bulkSoftDelete = async function (
      query,
      deletedBy = null
    ) {
      const update = {
        deleted: true,
        deletedAt: new Date(),
      };
      if (deletedBy) {
        update.deletedBy = deletedBy;
      }
      return await this.updateMany(query, update);
    };

    /**
     * Bulk restore
     */
    this.schema.statics.bulkRestore = async function (query) {
      return await this.updateMany(
        { ...query, deleted: true },
        {
          deleted: false,
          $unset: { deletedAt: 1, deletedBy: 1 },
        }
      );
    };

    /**
     * Get documents created in date range
     */
    this.schema.statics.findInDateRange = function (
      startDate,
      endDate,
      options = {}
    ) {
      return this.find(
        {
          createdAt: {
            $gte: startDate,
            $lte: endDate,
          },
          deleted: false,
        },
        null,
        options
      );
    };

    /**
     * Get recently created documents
     */
    this.schema.statics.findRecent = function (limit = 10, options = {}) {
      return this.find({ deleted: false })
        .sort({ createdAt: -1 })
        .limit(limit)
        .exec();
    };

    /**
     * Get recently updated documents
     */
    this.schema.statics.findRecentlyUpdated = function (
      limit = 10,
      options = {}
    ) {
      return this.find({ deleted: false })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .exec();
    };

    /**
     * Get statistics
     */
    this.schema.statics.getStats = async function () {
      const [total, active, deleted] = await Promise.all([
        this.countDocuments({}),
        this.countDocuments({ deleted: false }),
        this.countDocuments({ deleted: true }),
      ]);

      return {
        total,
        active,
        deleted,
        deletedPercentage: total > 0 ? (deleted / total) * 100 : 0,
      };
    };

    /**
     * Search with text index
     */
    this.schema.statics.search = function (searchText, options = {}) {
      const {
        limit = 10,
        skip = 0,
        sort = { score: { $meta: "textScore" } },
      } = options;

      return this.find(
        {
          $text: { $search: searchText },
          deleted: false,
        },
        { score: { $meta: "textScore" } }
      )
        .sort(sort)
        .limit(limit)
        .skip(skip);
    };

    /**
     * Find by IDs with error handling
     */
    this.schema.statics.findByIds = async function (ids, options = {}) {
      if (!Array.isArray(ids)) {
        throw new Error("ids must be an array");
      }

      const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));

      if (validIds.length === 0) {
        return [];
      }

      return await this.find(
        {
          _id: { $in: validIds },
          deleted: false,
        },
        null,
        options
      );
    };

    /**
     * Find one or fail
     */
    this.schema.statics.findOneOrFail = async function (query, options = {}) {
      const doc = await this.findOne(
        { ...query, deleted: false },
        null,
        options
      );
      if (!doc) {
        throw new Error(`${this.modelName} not found`);
      }
      return doc;
    };

    /**
     * Find by ID or fail
     */
    this.schema.statics.findByIdOrFail = async function (id, options = {}) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error("Invalid ID format");
      }
      const doc = await this.findById(id, null, options);
      if (!doc || doc.deleted) {
        throw new Error(`${this.modelName} not found`);
      }
      return doc;
    };
  }

  /**
   * Add common middleware
   * @private
   */
  _addCommonMiddleware() {
    // Pre-save middleware - update timestamps
    this.schema.pre("save", function (next) {
      // Only update updatedAt if document is not new
      if (!this.isNew) {
        this.updatedAt = new Date();
      }
      next();
    });

    // Pre-save middleware - increment schema version on changes
    this.schema.pre("save", function (next) {
      if (!this.isNew && this.isModified()) {
        const modifiedPaths = this.modifiedPaths();
        // Only increment if non-metadata fields were modified
        const significantChange = modifiedPaths.some(
          (path) =>
            !path.startsWith("metadata") &&
            path !== "updatedAt" &&
            path !== "updatedBy"
        );
        if (significantChange) {
          this.schemaVersion = (this.schemaVersion || 1) + 1;
        }
      }
      next();
    });

    // Pre-update middleware - update timestamps
    this.schema.pre(
      ["updateOne", "updateMany", "findOneAndUpdate"],
      function (next) {
        this.set({ updatedAt: new Date() });
        next();
      }
    );

    // Post-save middleware - log changes (optional, can be enabled)
    // this.schema.post('save', function(doc) {
    //     console.log(`${this.constructor.modelName} saved:`, doc._id);
    // });

    // Pre-remove middleware - prevent hard delete of soft-deleted items
    this.schema.pre("remove", function (next) {
      if (this.deleted) {
        next(
          new Error(
            "Cannot hard delete a soft-deleted document. Use Model.deleteOne() instead."
          )
        );
      }
      next();
    });
  }

  /**
   * JSON transformation - remove sensitive fields
   * @private
   */
  _jsonTransform(doc, ret, options) {
    // Remove Mongoose internal fields
    delete ret.__v;

    // Remove sensitive metadata
    delete ret.schemaVersion;

    // Convert _id to id
    ret.id = ret._id;
    delete ret._id;

    // Format dates
    if (ret.createdAt) {
      ret.createdAt = ret.createdAt.toISOString();
    }
    if (ret.updatedAt) {
      ret.updatedAt = ret.updatedAt.toISOString();
    }
    if (ret.deletedAt) {
      ret.deletedAt = ret.deletedAt.toISOString();
    }

    return ret;
  }

  /**
   * Object transformation
   * @private
   */
  _objectTransform(doc, ret, options) {
    // Remove Mongoose internal fields
    delete ret.__v;

    return ret;
  }

  /**
   * Get the schema
   * @returns {mongoose.Schema}
   */
  getSchema() {
    return this.schema;
  }

  /**
   * Create index helper
   * @param {Object} fields - Index fields
   * @param {Object} options - Index options
   */
  addIndex(fields, options = {}) {
    this.schema.index(fields, options);
  }

  /**
   * Add text index helper
   * @param {Object} fields - Fields to index
   * @param {Object} options - Index options
   */
  addTextIndex(fields, options = {}) {
    this.schema.index(fields, { ...options, type: "text" });
  }

  /**
   * Add unique index helper
   * @param {Object} fields - Fields to make unique
   * @param {Object} options - Index options
   */
  addUniqueIndex(fields, options = {}) {
    this.schema.index(fields, { ...options, unique: true });
  }

  /**
   * Add compound index helper
   * @param {Array} fields - Array of field definitions
   * @param {Object} options - Index options
   */
  addCompoundIndex(fields, options = {}) {
    const indexDef = {};
    fields.forEach((field) => {
      if (typeof field === "string") {
        indexDef[field] = 1;
      } else if (typeof field === "object") {
        Object.assign(indexDef, field);
      }
    });
    this.schema.index(indexDef, options);
  }

  /**
   * Add virtual property helper
   * @param {String} name - Virtual property name
   * @param {Function} getter - Getter function
   * @param {Function} setter - Setter function (optional)
   */
  addVirtual(name, getter, setter = null) {
    const virtual = this.schema.virtual(name);
    virtual.get(getter);
    if (setter) {
      virtual.set(setter);
    }
  }

  /**
   * Add instance method helper
   * @param {String} name - Method name
   * @param {Function} fn - Method function
   */
  addInstanceMethod(name, fn) {
    this.schema.methods[name] = fn;
  }

  /**
   * Add static method helper
   * @param {String} name - Method name
   * @param {Function} fn - Method function
   */
  addStaticMethod(name, fn) {
    this.schema.statics[name] = fn;
  }

  /**
   * Add pre middleware helper
   * @param {String|Array} hooks - Hook name(s)
   * @param {Function} fn - Middleware function
   */
  addPreHook(hooks, fn) {
    this.schema.pre(hooks, fn);
  }

  /**
   * Add post middleware helper
   * @param {String|Array} hooks - Hook name(s)
   * @param {Function} fn - Middleware function
   */
  addPostHook(hooks, fn) {
    this.schema.post(hooks, fn);
  }

  /**
   * Get the Mongoose model
   * @param {string} modelName - Name of the model
   * @returns {mongoose.Model} Mongoose model
   */
  getModel(modelName) {
    return mongoose.model(modelName, this.schema);
  }
}

export default BaseModel;
