import Queue from 'bull';
import processJob from '../jobProcessor.js';

// Create job queue with Redis configuration
const jobQueue = new Queue('jobQueue', {
    redis: {
        host: '127.0.0.1',
        port: 6379
    }
});

// Process jobs
jobQueue.process(async (job) => {
    try {
        if (!job.data || typeof job.data !== 'object') {
            throw new Error('Invalid job data');
        }
        console.log(`Processing job ${job.id} of type ${job.data.type}`);
        
        // Call the appropriate job processor
        await processJob(job);

        console.log(`Job ${job.id} processed successfully`);
    } catch (error) {
        console.error(`Failed to process job ${job.id}:`, error.message);
        throw error;
    }
});

// Job lifecycle handlers
jobQueue.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
});

jobQueue.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed:`, err.message);
});

// Function to add a job
const addJobToQueue = async (data) => {
    try {
        const job = await jobQueue.add(data);
        console.log(`Job ${job.id} added to queue`);
    } catch (error) {
        console.error('Error adding job to queue:', error.message);
    }
};


export default jobQueue;
