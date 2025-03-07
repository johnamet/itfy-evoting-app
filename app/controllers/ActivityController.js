/**
 * ActivityController class is responsible for handling all the activities related to the user.
 * It extends the BaseController class.
 * @class ActivityController 
 */

import Activity from "../models/activity.js";


class ActivityController{
    /**
     * 
     * @param {Request} req - The request object containing the categories
     * @param {Response} res - The response object.
     * @returns {Promise<Response} - The file content as a download. 
     */
    static async activities(req, res){
        try{
            const activities = await Activity.all();



            return res.status(200).send({
                success: true,
                activities: activities.filter((activity) => activity.action !== 'site_visit')
            });
        }catch(error){
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * 
     * @param {Request} req - The request object containing the activity details
     * @param {Response} res - The response object.
     * @returns {Promise<Response} - The file content as a download. 
     */
    static async createActivity(req, res, next){
        try{
            const { user_id, action, entity, entity_id, timestamp } = req.body;
            const activity = new Activity(user_id, action, entity, entity_id, timestamp);
            await activity.save();
            return res.status(201).send({
                success: true,
                activity
            });
        }catch(error){
           console.error("Activity creation error:", error);
        }
    }

    /**
     * 
     * @param {Request} req - The request object containing the site visit details
     * @param {Response} res - The response object.
     * @returns {Promise<Response>} - The site visit data.
     */
    static async siteVisits(req, res) {
        try {
            const siteVisits = await Activity.all({ action: 'site_visit' });
            return res.status(200).send({
                success: true,
                siteVisits
            });
        } catch (error) {
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * 
     * @param {Request} req - The request object containing the site visit details
     * @param {Response} res - The response object.
     * @returns {Promise<Response>} - The created site visit data.
     */
    static async postSiteVisit(req, res) {
        try {
            const ip_address = req.ip;
            const { timestamp } = req.body;
            const siteVisit = new Activity(null, 'site_visit', null, null, timestamp, ip_address);
            await siteVisit.save();
            return res.status(201).send({
                success: true,
                siteVisit
            });
        } catch (error) {
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }
}


export default ActivityController;
