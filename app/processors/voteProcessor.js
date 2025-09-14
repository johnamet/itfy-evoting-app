import { voteProcessingQueue } from '../config/queue.js';
import VoteService from '../services/VoteService.js';
import AnalyticsService from '../services/AnalyticsService.js';
import logger from '../utils/logger.js';

// Vote processing job processor
voteProcessingQueue.process('process-vote', async (job) => {
    const { voteData, userId, eventId } = job.data;
    
    try {
        logger.info(`Processing vote for user ${userId} in event ${eventId}`);
        
        // Process the vote
        const result = await VoteService.processVote(voteData, userId, eventId);
        
        // Update analytics asynchronously
        await AnalyticsService.updateVoteAnalytics(eventId, userId, voteData);
        
        return { success: true, voteId: result.id, message: 'Vote processed successfully' };
    } catch (error) {
        logger.error('Failed to process vote:', error);
        throw error;
    }
});

voteProcessingQueue.process('validate-vote-batch', async (job) => {
    const { votes, eventId } = job.data;
    
    try {
        logger.info(`Validating batch of ${votes.length} votes for event ${eventId}`);
        
        const validationResults = await VoteService.validateVoteBatch(votes, eventId);
        
        return { success: true, validationResults, message: 'Vote batch validated' };
    } catch (error) {
        logger.error('Failed to validate vote batch:', error);
        throw error;
    }
});

voteProcessingQueue.process('calculate-results', async (job) => {
    const { eventId, categoryId } = job.data;
    
    try {
        logger.info(`Calculating results for event ${eventId}, category ${categoryId}`);
        
        const results = await VoteService.calculateResults(eventId, categoryId);
        
        return { success: true, results, message: 'Results calculated successfully' };
    } catch (error) {
        logger.error('Failed to calculate results:', error);
        throw error;
    }
});

voteProcessingQueue.process('audit-votes', async (job) => {
    const { eventId, auditType } = job.data;
    
    try {
        logger.info(`Running ${auditType} audit for event ${eventId}`);
        
        const auditResult = await VoteService.auditVotes(eventId, auditType);
        
        return { success: true, auditResult, message: 'Vote audit completed' };
    } catch (error) {
        logger.error('Failed to audit votes:', error);
        throw error;
    }
});

voteProcessingQueue.process('generate-vote-report', async (job) => {
    const { eventId, reportType, filters } = job.data;
    
    try {
        logger.info(`Generating ${reportType} report for event ${eventId}`);
        
        const report = await VoteService.generateVoteReport(eventId, reportType, filters);
        
        return { success: true, report, message: 'Vote report generated' };
    } catch (error) {
        logger.error('Failed to generate vote report:', error);
        throw error;
    }
});

// Job scheduling helper functions
export const voteJobs = {
    // Schedule vote processing
    async scheduleVoteProcessing(voteData, userId, eventId, priority = 'normal') {
        const jobOptions = {
            priority: priority === 'high' ? 1 : priority === 'low' ? 10 : 5,
        };
        return await voteProcessingQueue.add('process-vote', { voteData, userId, eventId }, jobOptions);
    },

    // Schedule vote batch validation
    async scheduleVoteBatchValidation(votes, eventId, delay = 0) {
        const jobOptions = delay > 0 ? { delay } : {};
        return await voteProcessingQueue.add('validate-vote-batch', { votes, eventId }, jobOptions);
    },

    // Schedule results calculation
    async scheduleResultsCalculation(eventId, categoryId, delay = 0) {
        const jobOptions = delay > 0 ? { delay } : { priority: 2 }; // High priority for results
        return await voteProcessingQueue.add('calculate-results', { eventId, categoryId }, jobOptions);
    },

    // Schedule vote audit
    async scheduleVoteAudit(eventId, auditType = 'integrity', delay = 0) {
        const jobOptions = delay > 0 ? { delay } : {};
        return await voteProcessingQueue.add('audit-votes', { eventId, auditType }, jobOptions);
    },

    // Schedule vote report generation
    async scheduleVoteReportGeneration(eventId, reportType = 'summary', filters = {}, delay = 0) {
        const jobOptions = delay > 0 ? { delay } : {};
        return await voteProcessingQueue.add('generate-vote-report', { eventId, reportType, filters }, jobOptions);
    },

    // Schedule periodic results calculation
    async schedulePeriodicResultsCalculation(eventId, categoryId, interval = '*/5 * * * *') { // Every 5 minutes
        return await voteProcessingQueue.add('calculate-results', { eventId, categoryId }, {
            repeat: { cron: interval },
            removeOnComplete: 5,
            removeOnFail: 3,
        });
    },

    // Schedule delayed results finalization
    async scheduleResultsFinalization(eventId, finalizeAt) {
        const delay = new Date(finalizeAt).getTime() - Date.now();
        return await voteProcessingQueue.add('calculate-results', { eventId }, {
            delay: Math.max(0, delay),
            priority: 1, // Highest priority
        });
    },
};

export default voteJobs;
