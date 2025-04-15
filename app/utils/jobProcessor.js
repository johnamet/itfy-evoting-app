import Activity from "../models/activity.js";

async function processJob(job) {
    
    try {
        if (job.data.type === "activity"){
            const activity = Activity.from_object(job.data.payload);
        await activity.save()
        }
        
        console.log('Job processed successfully');
    } catch (error) {
        console.error('Error processing job:', error);
    }
}

export default  processJob ;