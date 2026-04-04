import mongoose from "mongoose";
import { logger } from "../services/logger.service.js";

export async function connectDB(maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
        socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      });
      logger.info("MongoDB connected successfully");
      return;
    } catch (err) {
      logger.error(`MongoDB connection attempt ${attempt}/${maxRetries} failed: ${err.message}`);

      if (attempt === maxRetries) {
        logger.error("Max retries reached. Exiting...");
        process.exit(1);
      }

      // Exponential backoff: 1s, 2s, 4s, 8s, 16s
      const delay = Math.pow(2, attempt - 1) * 1000;
      logger.info(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
