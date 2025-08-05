#!/usr/bin/env node
/**
 * VoteBundle Controller
 * 
 * Handles vote bundle operations including CRUD and filtering by event/category.
 */

import BaseController from './BaseController.js';
import VoteBundleService from '../services/VoteBundleService.js';

export default class VoteBundleController extends BaseController {
    constructor() {
        super();
        this.voteBundleService = new VoteBundleService();
    }

    /**
     * Get all vote bundles with filtering and pagination
     */
    async getVoteBundles(req, res) {
        try {
            const query = req.query;
            const bundles = await this.voteBundleService.getVoteBundles(query);
            return this.sendSuccess(res, bundles, 'Vote bundles retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get vote bundles');
        }
    }

    /**
     * Get vote bundle by ID
     */
    async getVoteBundleById(req, res) {
        try {
            const { id } = req.params;
            const includeVotes = req.query.include === 'votes';

            const bundle = await this.voteBundleService.getVoteBundleById(id, includeVotes);

            if (!bundle) {
                return this.sendError(res, 'Vote bundle not found', 404);
            }

            return this.sendSuccess(res, bundle, 'Vote bundle retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get vote bundle');
        }
    }

    /**
     * Get vote bundles by event
     */
    async getVoteBundlesByEvent(req, res) {
        try {
            const { eventId } = req.params;
            const query = req.query;

            const bundles = await this.voteBundleService.getVoteBundlesByEvent(eventId, query);
            return this.sendSuccess(res, bundles, 'Event vote bundles retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get event vote bundles');
        }
    }

    /**
     * Get vote bundles by category
     */
    async getVoteBundlesByCategory(req, res) {
        try {
            const { categoryId } = req.params;
            const query = req.query;

            const bundles = await this.voteBundleService.getVoteBundlesByCategory(categoryId, query);
            return this.sendSuccess(res, bundles, 'Category vote bundles retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get category vote bundles');
        }
    }

    /**
     * Get vote bundles by event and category
     */
    async getVoteBundlesByEventAndCategory(req, res) {
        try {
            const { eventId, categoryId } = req.params;
            const query = req.query;

            const bundles = await this.voteBundleService.getVoteBundlesByEventAndCategory(eventId, categoryId, query);
            return this.sendSuccess(res, bundles, 'Event and category vote bundles retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get event and category vote bundles');
        }
    }

    /**
     * Create vote bundle
     */
    async createVoteBundle(req, res) {
        try {
            const bundleData = req.body;
            const createdBy = req.user?.id;

            if (!createdBy) {
                return this.sendError(res, 'User authentication required', 401);
            }

            const bundle = await this.voteBundleService.createVoteBundle({
                ...bundleData,
                createdBy
            });

            return this.sendSuccess(res, bundle, 'Vote bundle created successfully', 201);
        } catch (error) {
            return this.handleError(res, error, 'Failed to create vote bundle');
        }
    }

    /**
     * Update vote bundle
     */
    async updateVoteBundle(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const updatedBy = req.user?.id;

            const bundle = await this.voteBundleService.updateVoteBundle(id, {
                ...updateData,
                updatedBy
            });

            if (!bundle) {
                return this.sendError(res, 'Vote bundle not found', 404);
            }

            return this.sendSuccess(res, bundle, 'Vote bundle updated successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to update vote bundle');
        }
    }

    /**
     * Delete vote bundle
     */
    async deleteVoteBundle(req, res) {
        try {
            const { id } = req.params;
            const deletedBy = req.user?.id;

            const result = await this.voteBundleService.deleteVoteBundle(id, deletedBy);

            if (!result) {
                return this.sendError(res, 'Vote bundle not found', 404);
            }

            return this.sendSuccess(res, null, 'Vote bundle deleted successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to delete vote bundle');
        }
    }

    /**
     * Get vote bundle statistics
     */
    async getVoteBundleStats(req, res) {
        try {
            const query = req.query;
            const stats = await this.voteBundleService.getVoteBundleStats(query);
            return this.sendSuccess(res, stats, 'Vote bundle statistics retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get vote bundle statistics');
        }
    }
}
