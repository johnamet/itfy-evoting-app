#!/usr/bin/env node
/**
 * Candidate Controller
 * 
 * Handles candidate management operations for voting.
 *
 * @swagger
 * tags:
 *   name: Candidates
 *   description: Manages candidates within events
 */

import BaseController from './BaseController.js';
import CandidateService from '../services/CandidateService.js';

export default class CandidateController extends BaseController {
    constructor() {
        super();
        this.candidateService = new CandidateService();
    }

    /**
     * Create a new candidate
     */
    async createCandidate(req, res) {
        try {
            const candidateData = req.body;
            const createdBy = req.user?.id;

            if (!createdBy) {
                return this.sendError(res, 'User authentication required', 401);
            }

            const candidate = await this.candidateService.createCandidate(candidateData, createdBy);

            return this.sendSuccess(res, candidate, 'Candidate created successfully', 201);
        } catch (error) {
            return this.handleError(res, error, 'Failed to create candidate');
        }
    }

    /**
     * List candidates (alias for getCandidates)
     * GET /api/candidates
     */
    async list(req, res) {
        return this.getCandidates(req, res);
    }

    /**
     * Create candidate (alias for createCandidate)
     * POST /api/candidates
     */
    async create(req, res) {
        return this.createCandidate(req, res);
    }

    /**
     * Get all candidates with filtering and pagination
     */
    async getCandidates(req, res) {
        try {
            const query = req.query;

            if (query.category) {
                query.categories = query.category;
                delete query.category;
            }

            const candidates = await this.candidateService.getCandidates(query);
            return this.sendSuccess(res, candidates, 'Candidates retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get candidates');
        }
    }

    /**
     * Get candidate by ID
     */
    async getCandidateById(req, res) {
        try {
            const { id } = req.params;
            const includeVotes = req.query.include === 'votes';

            const candidate = await this.candidateService.getCandidateById(id, includeVotes);

            if (!candidate) {
                return this.sendError(res, 'Candidate not found', 404);
            }

            return this.sendSuccess(res, candidate, 'Candidate retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get candidate');
        }
    }

    /**
     * Find candidate by cId
     * GET /api/candidates/cid/:cid
     */
    async findByCId(req, res) {
        try {
            const { cid } = req.params;

            if (!cid) {
                return this.sendError(res, 'Candidate cId is required', 400);
            }

            const result = await this.candidateService.findByCId(cid);

            if (!result.success) {
                return this.sendError(res, 'Candidate not found', 404);
            }

            return this.sendSuccess(res, result.candidate, 'Candidate retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to find candidate by cId');
        }
    }

    /**
     * Update candidate
     */
    async updateCandidate(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const updatedBy = req.user?.id;

            if (!updatedBy) {
                return this.sendError(res, 'User authentication required', 401);
            }

            const candidate = await this.candidateService.updateCandidate(id, updateData, updatedBy);

            if (!candidate) {
                return this.sendError(res, 'Candidate not found', 404);
            }

            return this.sendSuccess(res, candidate, 'Candidate updated successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to update candidate');
        }
    }

    /**
     * Delete candidate
     */
    async deleteCandidate(req, res) {
        try {
            const { id } = req.params;
            const deletedBy = req.user?.id;

            const result = await this.candidateService.deleteCandidate(id, deletedBy);

            if (!result) {
                return this.sendError(res, 'Candidate not found', 404);
            }

            return this.sendSuccess(res, null, 'Candidate deleted successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to delete candidate');
        }
    }

    /**
     * Get candidates by event
     */
    async getCandidatesByEvent(req, res) {
        try {
            const { eventId } = req.params;
            const query = req.query;

            const candidates = await this.candidateService.getCandidatesByEvent(eventId, query);
            return this.sendSuccess(res, candidates, 'Event candidates retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get event candidates');
        }
    }

    /**
     * Get candidates by category
     */
    async getCandidatesByCategory(req, res) {
        try {
            const { categoryId } = req.params;
            const query = req.query;

            const candidates = await this.candidateService.getCandidatesByCategory(categoryId, query);
            return this.sendSuccess(res, candidates, 'Category candidates retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get category candidates');
        }
    }

    /**
     * Get candidate vote count
     */
    async getCandidateVoteCount(req, res) {
        try {
            const { id } = req.params;

            const voteCount = await this.candidateService.getCandidateVoteCount(id);
            return this.sendSuccess(res, { voteCount }, 'Candidate vote count retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get candidate vote count');
        }
    }

    /**
     * Upload candidate image
     */
    async uploadCandidateImage(req, res) {
        try {
            const { id } = req.params;
            const file = req.file;

            if (!file) {
                return this.sendError(res, 'Image file is required', 400);
            }

            const imageUrl = await this.candidateService.uploadCandidateImage(id, file);

            if (!imageUrl) {
                return this.sendError(res, 'Candidate not found', 404);
            }

            return this.sendSuccess(res, { imageUrl }, 'Candidate image uploaded successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to upload candidate image');
        }
    }

    /**
     * Update candidate status
     */
    async updateCandidateStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const updatedBy = req.user?.id;

            if (!status) {
                return this.sendError(res, 'Status is required', 400);
            }

            const candidate = await this.candidateService.updateCandidate(id, {status}, updatedBy);

            if (!candidate) {
                return this.sendError(res, 'Candidate not found', 404);
            }

            return this.sendSuccess(res, candidate, 'Candidate status updated successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to update candidate status');
        }
    }

    /**
     * Get candidate statistics
     */
    async getCandidateStats(req, res) {
        try {
            const { id } = req.params;
            const stats = await this.candidateService.getCandidateStats(id);

            if (!stats) {
                return this.sendError(res, 'Candidate not found', 404);
            }

            return this.sendSuccess(res, stats, 'Candidate statistics retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get candidate statistics');
        }
    }

    /**
     * Get detailed candidate statistics
     * @swagger
     * /api/candidates/{id}/statistics:
     *   get:
     *     summary: Get detailed statistics for a candidate
     *     tags: [Candidates]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Candidate ID
     *     responses:
     *       200:
     *         description: Detailed candidate statistics retrieved successfully
     *       404:
     *         description: Candidate not found
     */
    async getCandidateStatistics(req, res) {
        try {
            const { id } = req.params;
            const statistics = await this.candidateService.getCandidateStatistics(id);

            if (!statistics) {
                return this.sendError(res, 'Candidate not found', 404);
            }

            return this.sendSuccess(res, statistics, 'Detailed candidate statistics retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get detailed candidate statistics');
        }
    }

    /**
     * Search candidates by term
     * @swagger
     * /api/candidates/search:
     *   get:
     *     summary: Search candidates by name or description
     *     tags: [Candidates]
     *     parameters:
     *       - in: query
     *         name: searchTerm
     *         required: true
     *         schema:
     *           type: string
     *         description: Search term to find candidates
     *       - in: query
     *         name: event
     *         schema:
     *           type: string
     *         description: Filter by event ID
     *       - in: query
     *         name: category
     *         schema:
     *           type: string
     *         description: Filter by category ID
     *     responses:
     *       200:
     *         description: Candidates search completed successfully
     *       400:
     *         description: Search term is required
     */
    async searchCandidates(req, res) {
        try {
            const { searchTerm } = req.query;
            const options = { ...req.query };
            delete options.searchTerm;

            if (!searchTerm) {
                return this.sendError(res, 'Search term is required', 400);
            }

            const candidates = await this.candidateService.searchCandidates(searchTerm, options);
            return this.sendSuccess(res, candidates, 'Candidates search completed successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to search candidates');
        }
    }

    /**
     * Get top performing candidates
     * @swagger
     * /api/candidates/top/{eventId}:
     *   get:
     *     summary: Get top performing candidates by votes
     *     tags: [Candidates]
     *     parameters:
     *       - in: path
     *         name: eventId
     *         schema:
     *           type: string
     *         description: Event ID (optional)
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           default: 10
     *         description: Number of top candidates to return
     *     responses:
     *       200:
     *         description: Top candidates retrieved successfully
     */
    async getTopCandidates(req, res) {
        try {
            const { eventId } = req.params;
            const { limit = 10 } = req.query;

            const topCandidates = await this.candidateService.getTopCandidates(eventId, parseInt(limit));
            return this.sendSuccess(res, topCandidates, 'Top candidates retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get top candidates');
        }
    }

    /**
     * Bulk create candidates
     * @swagger
     * /api/candidates/bulk:
     *   post:
     *     summary: Create multiple candidates at once
     *     tags: [Candidates]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               candidates:
     *                 type: array
     *                 items:
     *                   $ref: '#/components/schemas/Candidate'
     *     responses:
     *       201:
     *         description: Candidates created successfully
     *       400:
     *         description: Invalid candidates data
     *       401:
     *         description: Authentication required
     */
    async bulkCreateCandidates(req, res) {
        try {
            const { candidates } = req.body;
            const createdBy = req.user?.id;

            if (!createdBy) {
                return this.sendError(res, 'User authentication required', 401);
            }

            if (!Array.isArray(candidates) || candidates.length === 0) {
                return this.sendError(res, 'Candidates array is required and cannot be empty', 400);
            }

            const result = await this.candidateService.bulkCreateCandidates(candidates, createdBy);
            return this.sendSuccess(res, result, 'Candidates created successfully', 201);
        } catch (error) {
            return this.handleError(res, error, 'Failed to bulk create candidates');
        }
    }

    /**
     * Add category to candidate
     * @swagger
     * /api/candidates/{id}/categories/{categoryId}:
     *   post:
     *     summary: Add a category to a candidate
     *     tags: [Candidates]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Candidate ID
     *       - in: path
     *         name: categoryId
     *         required: true
     *         schema:
     *           type: string
     *         description: Category ID
     *     responses:
     *       200:
     *         description: Category added to candidate successfully
     *       404:
     *         description: Candidate or category not found
     *       401:
     *         description: Authentication required
     */
    async addCategoryToCandidate(req, res) {
        try {
            const { id, categoryId } = req.params;
            const updatedBy = req.user?.id;

            if (!updatedBy) {
                return this.sendError(res, 'User authentication required', 401);
            }

            const candidate = await this.candidateService.addCategoryToCandidate(id, categoryId, updatedBy);

            if (!candidate) {
                return this.sendError(res, 'Candidate or category not found', 404);
            }

            return this.sendSuccess(res, candidate, 'Category added to candidate successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to add category to candidate');
        }
    }

    /**
     * Remove category from candidate
     * @swagger
     * /api/candidates/{id}/categories/{categoryId}:
     *   delete:
     *     summary: Remove a category from a candidate
     *     tags: [Candidates]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Candidate ID
     *       - in: path
     *         name: categoryId
     *         required: true
     *         schema:
     *           type: string
     *         description: Category ID
     *     responses:
     *       200:
     *         description: Category removed from candidate successfully
     *       404:
     *         description: Candidate or category not found
     *       401:
     *         description: Authentication required
     */
    async removeCategoryFromCandidate(req, res) {
        try {
            const { id, categoryId } = req.params;
            const updatedBy = req.user?.id;

            if (!updatedBy) {
                return this.sendError(res, 'User authentication required', 401);
            }

            const candidate = await this.candidateService.removeCategoryFromCandidate(id, categoryId, updatedBy);

            if (!candidate) {
                return this.sendError(res, 'Candidate or category not found', 404);
            }

            return this.sendSuccess(res, candidate, 'Category removed from candidate successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to remove category from candidate');
        }
    }

    /**
     * Update candidate photo
     * @swagger
     * /api/candidates/{id}/photo:
     *   put:
     *     summary: Update candidate photo
     *     tags: [Candidates]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Candidate ID
     *     requestBody:
     *       required: true
     *       content:
     *         multipart/form-data:
     *           schema:
     *             type: object
     *             properties:
     *               photo:
     *                 type: string
     *                 format: binary
     *     responses:
     *       200:
     *         description: Candidate photo updated successfully
     *       400:
     *         description: Photo file is required
     *       404:
     *         description: Candidate not found
     *       401:
     *         description: Authentication required
     */
    async updateCandidatePhoto(req, res) {
        try {
            const { id } = req.params;
            const updatedBy = req.user?.id;
            const file = req.file;

            if (!updatedBy) {
                return this.sendError(res, 'User authentication required', 401);
            }

            if (!file) {
                return this.sendError(res, 'Photo file is required', 400);
            }

            const candidate = await this.candidateService.updateCandidatePhoto(id, file, updatedBy);

            if (!candidate) {
                return this.sendError(res, 'Candidate not found', 404);
            }

            return this.sendSuccess(res, candidate, 'Candidate photo updated successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to update candidate photo');
        }
    }

    /**
     * Remove candidate photo
     * @swagger
     * /api/candidates/{id}/photo:
     *   delete:
     *     summary: Remove candidate photo
     *     tags: [Candidates]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Candidate ID
     *     responses:
     *       200:
     *         description: Candidate photo removed successfully
     *       404:
     *         description: Candidate not found
     *       401:
     *         description: Authentication required
     */
    async removeCandidatePhoto(req, res) {
        try {
            const { id } = req.params;
            const updatedBy = req.user?.id;

            if (!updatedBy) {
                return this.sendError(res, 'User authentication required', 401);
            }

            const candidate = await this.candidateService.removeCandidatePhoto(id, updatedBy);

            if (!candidate) {
                return this.sendError(res, 'Candidate not found', 404);
            }

            return this.sendSuccess(res, candidate, 'Candidate photo removed successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to remove candidate photo');
        }
    }
}
