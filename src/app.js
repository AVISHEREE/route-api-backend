import "./loadEnv.js"; 
import express from "express";
import cors from "cors";
import { logger } from "./services/logger.service.js";
import busRoutes from "./routes/bus.routes.js";
import trainRoutes from "./routes/train.routes.js";
import flightRoutes from "./routes/flight.routes.js";
import segmentRoutes from "./routes/segment.routes.js";
import authRoutes from "./routes/auth.routes.js";
import savedRouteRoutes from "./routes/savedRoute.routes.js";
import historyRoutes from "./routes/history.routes.js";

const app = express();

// CORS configuration
const allowedOrigins = process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : ['http://localhost:3000'];

// const corsOptions = {
//   origin: function (origin, callback) {
//     if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
//       callback(null, true);
//     } else {
//       callback(new Error('Not allowed by CORS'));
//     }
//   },
//   optionsSuccessStatus: 200
// };

app.use(cors({origin:"*"})); // Enable CORS with options

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/search-history", historyRoutes);
app.use("/api/saved-route", savedRouteRoutes);
app.use("/api/bus", busRoutes);
app.use("/api/train", trainRoutes);
app.use("/api/flight", flightRoutes);
app.use("/api/segment", segmentRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

export default app;
