#!/usr/bin/env node
/**
 * Nomination Routes
 * 
 * Routes for candidate nomination management:
 * - Public nomination submission
 * - Admin review and approval
 * - Nomination listing and statistics
 * 
 * @module routes/nominationRoutes
 * @version 1.0.0
 */

import express from 'express';
import { nominationController } from '../controllers/index.js';
import { authenticate, requireLevel } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Nominations
 *   description: Candidate nomination management
 */

/**
 * @swagger
 * /api/v1/nominations/submit:
 *   post:
 *     summary: Submit a new nomination (public endpoint)
 *     tags: [Nominations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventId
 *               - categoryId
 *               - nominator
 *               - nominee
 *             properties:
 *               eventId:
 *                 type: string
 *               categoryId:
 *                 type: string
 *               nominator:
 *                 type: object
 *                 required:
 *                   - name
 *                   - email
 *                 properties:
 *                   name:
 *                     type: string
 *                   email:
 *                     type: string
 *                   phone:
 *                     type: string
 *                   relationship:
 *                     type: string
 *               nominee:
 *                 type: object
 *                 required:
 *                   - name
 *                   - email
 *                   - reasonForNomination
 *                 properties:
 *                   name:
 *                     type: string
 *                   email:
 *                     type: string
 *                   phone:
 *                     type: string
 *                   reasonForNomination:
 *                     type: string
 *                     minLength: 50
 *                     maxLength: 1000
 *     responses:
 *       201:
 *         description: Nomination submitted successfully
 *       400:
 *         description: Validation error or duplicate nomination
 */
router.post('/submit', nominationController.submitNomination);

/**
 * @swagger
 * /api/v1/nominations/pending/{eventId}:
 *   get:
 *     summary: Get pending nominations for admin review
 *     tags: [Nominations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Pending nominations retrieved
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.get('/pending/:eventId', authenticate, requireLevel(3), nominationController.getPendingNominations);

/**
 * @swagger
 * /api/v1/nominations/event/{eventId}:
 *   get:
 *     summary: Get all nominations for an event
 *     tags: [Nominations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, duplicate]
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Nominations retrieved
 *       401:
 *         description: Unauthorized
 */
router.get('/event/:eventId', authenticate, requireLevel(2), nominationController.getNominationsByEvent);

/**
 * @swagger
 * /api/v1/nominations/category/{categoryId}:
 *   get:
 *     summary: Get nominations by category
 *     tags: [Nominations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Category nominations retrieved
 */
router.get('/category/:categoryId', authenticate, requireLevel(2), nominationController.getNominationsByCategory);

/**
 * @swagger
 * /api/v1/nominations/{nominationId}:
 *   get:
 *     summary: Get nomination details
 *     tags: [Nominations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: nominationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Nomination details retrieved
 *       404:
 *         description: Nomination not found
 */
router.get('/:nominationId', authenticate, requireLevel(2), nominationController.getNominationDetails);

/**
 * @swagger
 * /api/v1/nominations/{nominationId}/approve:
 *   post:
 *     summary: Approve a nomination (admin only)
 *     tags: [Nominations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: nominationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Nomination approved and verification email sent
 *       400:
 *         description: Invalid nomination status
 *       403:
 *         description: Insufficient permissions
 */
router.post('/:nominationId/approve', authenticate, requireLevel(3), nominationController.approveNomination);

/**
 * @swagger
 * /api/v1/nominations/{nominationId}/reject:
 *   post:
 *     summary: Reject a nomination (admin only)
 *     tags: [Nominations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: nominationId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Nomination rejected
 *       400:
 *         description: Invalid nomination status or missing reason
 *       403:
 *         description: Insufficient permissions
 */
router.post('/:nominationId/reject', authenticate, requireLevel(3), nominationController.rejectNomination);

/**
 * @swagger
 * /api/v1/nominations/bulk-approve:
 *   post:
 *     summary: Bulk approve nominations (admin only)
 *     tags: [Nominations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nominationIds
 *             properties:
 *               nominationIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Bulk approval processed
 *       403:
 *         description: Insufficient permissions
 */
router.post('/bulk-approve', authenticate, requireLevel(3), nominationController.bulkApproveNominations);

/**
 * @swagger
 * /api/v1/nominations/stats/{eventId}:
 *   get:
 *     summary: Get nomination statistics for an event
 *     tags: [Nominations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Statistics retrieved
 */
router.get('/stats/:eventId', authenticate, requireLevel(2), nominationController.getNominationStats);

/**
 * @swagger
 * /api/v1/nominations/search:
 *   get:
 *     summary: Search nominations
 *     tags: [Nominations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: eventId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Search results retrieved
 */
router.get('/search', authenticate, requireLevel(2), nominationController.searchNominations);

/**
 * @swagger
 * /api/v1/nominations/resend-verification/{candidateId}:
 *   post:
 *     summary: Resend verification email to nominee (admin only)
 *     tags: [Nominations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: candidateId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Verification email sent
 *       400:
 *         description: Invalid candidate status
 *       403:
 *         description: Insufficient permissions
 */
router.post('/resend-verification/:candidateId', authenticate, requireLevel(3), nominationController.resendVerificationEmail);

export default router;
