import io from 'socket.io'

/**
 * Sends a notification to all connected clients via a specified event.
 *
 * @param {string} event - The name of the event to emit.
 * @param {Object} data - The data to send with the event.
 */
const sendNotification = (event, data) => {
    io.emit(event, data);
}


