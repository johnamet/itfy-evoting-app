#!/usr/bin/env node
/**
 * Activity Controller
 * 
 * Handles activity logging and audit trail operations.
 */

import BaseController from './BaseController.js';
import ActivityService from '../services/ActivityService.js';

export default class ActivityController extends BaseController {
    constructor() {
        super();
        this.activityService = new ActivityService();
    }

    /**
     * Get activities with filtering and pagination
     */
    async getActivities(req, res) {
        try {
            const query = req.query;
            const activities = await this.activityService.getActivities(query);
            return this.sendSuccess(res, activities, 'Activities retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get activities');
        }
    }

    /**
     * Get activity by ID
     */
    async getActivityById(req, res) {
        try {
            const { id } = req.params;

            const activity = await this.activityService.getActivityById(id);
            
            if (!activity) {
                return this.sendError(res, 'Activity not found', 404);
            }

            return this.sendSuccess(res, activity, 'Activity retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get activity');
        }
    }

    /**
     * Get activities by user
     */
    async getActivitiesByUser(req, res) {
        try {
            const { userId } = req.params;
            const query = req.query;

            // Users can only view their own activities unless they're admin
            if (userId !== req.user?.id && req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const activities = await this.activityService.getActivitiesByUser(userId, query);
            return this.sendSuccess(res, activities, 'User activities retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get user activities');
        }
    }

    /**
     * Get activities by entity (e.g., event, candidate, etc.)
     */
    async getActivitiesByEntity(req, res) {
        try {
            const { entityType, entityId } = req.params;
            const query = req.query;

            const activities = await this.activityService.getActivitiesByEntity(entityType, entityId, query);
            return this.sendSuccess(res, activities, 'Entity activities retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get entity activities');
        }
    }

    /**
     * Log a new activity (usually called internally by other services)
     */
    async logActivity(req, res) {
        try {
            const activityData = req.body;
            const userId = req.user?.id;

            if (!userId) {
                return this.sendError(res, 'User authentication required', 401);
            }

            const activity = await this.activityService.logActivity({
                ...activityData,
                userId
            });

            return this.sendSuccess(res, activity, 'Activity logged successfully', 201);
        } catch (error) {
            return this.handleError(res, error, 'Failed to log activity');
        }
    }

    /**
     * Get activity statistics
     */
    async getActivityStats(req, res) {
        try {
            const query = req.query;
            const stats = await this.activityService.getActivityStats(query);
            return this.sendSuccess(res, stats, 'Activity statistics retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get activity statistics');
        }
    }

    /**
     * Get recent activities
     */
    async getRecentActivities(req, res) {
        try {
            const query = req.query;
            const activities = await this.activityService.getRecentActivities(query);
            return this.sendSuccess(res, activities, 'Recent activities retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get recent activities');
        }
    }

    /**
     * Export activity log
     */
    async exportActivityLog(req, res) {
        try {
            const query = req.query;
            const { format = 'json' } = query;

            // Only admins can export activity logs
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const exportData = await this.activityService.exportActivityLog(query, format);

            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename=activity-log.csv');
            } else {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', 'attachment; filename=activity-log.json');
            }

            return res.send(exportData);
        } catch (error) {
            return this.handleError(res, error, 'Failed to export activity log');
        }
    }

    /**
     * Delete old activities (cleanup)
     */
    async cleanupOldActivities(req, res) {
        try {
            const { olderThanDays = 365 } = req.query;

            // Only admins can cleanup activities
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const result = await this.activityService.cleanupOldActivities(parseInt(olderThanDays));
            return this.sendSuccess(res, result, 'Old activities cleaned up successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to cleanup old activities');
        }
    }

    /**
     * Get activity types and their counts
     */
    async getActivityTypes(req, res) {
        try {
            const query = req.query;
            const types = await this.activityService.getActivityTypes(query);
            return this.sendSuccess(res, types, 'Activity types retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get activity types');
        }
    }
}
