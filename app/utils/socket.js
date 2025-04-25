let io;
const setupSocket = (io) => {
    io = io;
    io.on("connection", (socket) => {
      console.log("Client connected:", socket.id);
  
      socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
      });
  
      // Example event for testing
      socket.on("testEvent", (data) => {
        console.log("Received testEvent:", data);
        io.emit("testEventResponse", { message: "Event received", data });
      });
    });
  };


  
  export default setupSocket;

  export {io};
  