#!/usr/bin/env node
/**
 * Candidate Controller
 * 
 * Handles candidate management operations for voting.
 */

import BaseController from './BaseController.js';
import CandidateService from '../services/CandidateService.js';
import mongoose from 'mongoose';

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

            const candidate = await this.candidateService.createCandidate({
                ...candidateData,
                createdBy
            });

            return this.sendSuccess(res, candidate, 'Candidate created successfully', 201);
        } catch (error) {
            return this.handleError(res, error, 'Failed to create candidate');
        }
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
     * Update candidate
     */
    async updateCandidate(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const updatedBy = req.user?.id;

            const candidate = await this.candidateService.updateCandidate(id, {
                ...updateData,
                updatedBy
            });

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

            const candidate = await this.candidateService.updateCandidateStatus(id, status, updatedBy);

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
}
