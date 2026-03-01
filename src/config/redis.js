import Redis from "ioredis";
import { logger } from "../services/logger.service.js";

const redisUrl = process.env.REDIS_URL;

export const redis = redisUrl
  ? new Redis(redisUrl)
  : new Redis({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 2,
    });

redis.on("error", (err) => {
  logger.warn(`Redis error: ${err.message}`);
});
