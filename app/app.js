import express, { json } from "express";
import http from "http"; // Added for WebSocket integration
import { Server } from "socket.io"; // WebSocket library
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
import { connectDatabase } from "./config/db.js"; // Connect to MongoDB
import { monitorDatabase, scheduleUpdates } from "./utils/scheduler.js"; // Activity tracking
import router from "./routes/index.js";

const app = express();
const PORT = process.env.PORT || 8000;

// Create HTTP server to integrate WebSocket
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Update to your allowed domains in production
  },
});

// Middleware for parsing JSON
app.use(json());

// Middleware for security headers
app.use(helmet());

// Middleware for CORS
app.use(
  cors({
    origin: "*", // Update to your allowed domains in production
    methods: "GET,POST,PUT,DELETE",
    allowedHeaders: "Content-Type,Authorization",
  })
);

// Logging middleware
app.use(morgan("combined"));

// Rate Limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: "Too many requests, please try again later." },
});
app.use(limiter);

// Throttling middleware
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per 15 minutes, then delay
  delayMs: () => 500, // Delay each request by 500ms after the limit
});
app.use(speedLimiter);

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

// Router
app.use("/evoting/", router);

// Real-time monitoring
connectDatabase(); // Ensure the database is connected
monitorDatabase(io); // Watch for changes in the database
scheduleUpdates(io); // Schedule periodic updates

// Error-handling middleware to format error responses as JSON
app.use((err, req, res, next) => {
  console.error(err.stack); // Log the error stack for debugging
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal Server Error",
  });
});

// Catch-all handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
