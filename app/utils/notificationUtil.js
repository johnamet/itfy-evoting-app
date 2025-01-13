import { websocket } from "../server.js";

// Store subscriptions for candidates
const candidateSubscriptions = {};

/**
 * Sends a notification to all connected clients via a specified event.
 *
 * @param {string} event - The name of the event to emit.
 * @param {Object} data - The data to send with the event.
 */
const pushNotification = (event, data) => {
    websocket.emit(event, data);
};

/**
 * Creates a subscription for a new candidate.
 *
 * @param {string} candidateId - The unique ID of the candidate.
 */
const subscribeToCandidate = (candidateId) => {
    if (!candidateSubscriptions[candidateId]) {
        candidateSubscriptions[candidateId] = [];
        console.log(`Subscription created for candidate: ${candidateId}`);
    } else {
        console.log(`Candidate ${candidateId} already has a subscription.`);
    }
};

/**
 * Sends a notification to all clients subscribed to a specific candidate.
 *
 * @param {string} candidateId - The unique ID of the candidate.
 * @param {Object} data - The data to send to the subscribers.
 */
const notifyCandidateSubscribers = (candidateId, data) => {
    if (candidateSubscriptions[candidateId]) {
        websocket.emit(`candidate:${candidateId}`, data);
        console.log(`Notification sent to subscribers of candidate: ${candidateId}`);
    } else {
        console.error(`No subscriptions found for candidate: ${candidateId}`);
    }
};

export default {
    pushNotification,
    subscribeToCandidate,
    notifyCandidateSubscribers,
};
