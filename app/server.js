import  { json } from "express";
import http from "http";
import { Server } from "socket.io";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
import router from "./routes/index.js";
import setupSocket from "./utils/socket.js";
import app from "./swagger.js";
import "./utils/promo-cleanup.js"; // Import the cron job for promo code cleanup

const PORT = process.env.PORT || 8000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:63342", "*"], // Update for production
    methods: ["GET", "POST","PUT", "DELETE"],
  },
});

// Setup Socket.IO events
setupSocket(io);


// Middleware
app.use(json());
app.use(helmet());
app.use(cors({ origin: "http://localhost:63342", methods: "GET,POST,PUT,DELETE", allowedHeaders: "Content-Type,Authorization" }));
app.use(morgan("combined"));

// Middleware for pretty-printing JSON responses
app.use((req, res, next) => {
  const originalSend = res.send;
  res.send = function (body) {
    if (typeof body === "object") {
      body = JSON.stringify(body, null, 2); // Pretty-print JSON
      res.setHeader("Content-Type", "application/json");
    }
    originalSend.call(this, body);
  };
  next();
});

// Attach io to req in middleware
app.use((req, res, next) => {
  req.io = io;
  next();
});


// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { error: "Too many requests, try later." } });
app.use(limiter);

const speedLimiter = slowDown({ windowMs: 15 * 60 * 1000, delayAfter: 50, delayMs: () => 500 });
app.use(speedLimiter);

// Routes
app.use("/evoting/api/v1", router);

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ success: false, error: err.message || "Internal Server Error" });
});

// Start server
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

export {io as websocket};
export default server;
