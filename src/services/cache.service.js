import { redis } from "../config/redis.js";
import RouteCache from "../models/RouteCache.js";
import { config } from "./config.service.js";
import { logger } from "./logger.service.js";

const DEFAULT_TTL_SECONDS = config.cache.ttl;

/**
 * GET CACHE
 */
export async function getCache(key) {
  if (!key) return null;
  console.log(`Cache lookup for key=${key}`);
  // 1️⃣ Check Redis
  try {
    const redisData = await redis.get(key);
    if (redisData) {
      try {
        return JSON.parse(redisData);
      } catch (err) {
        logger.warn(`Cache JSON parse failed for key=${key}`);
        await redis.del(key);
      }
    }
  } catch (err) {
    logger.warn(`Redis get failed for key=${key}: ${err.message}`);
  }

  // 2️⃣ Check Mongo
  try {
    const mongoData = await RouteCache.findOne({ key }).lean();
    if (mongoData) {
      // Sync back to Redis
      try {
        await redis.set(
          key,
          JSON.stringify(mongoData.data),
          "EX",
          DEFAULT_TTL_SECONDS,
        );
      } catch (err) {
        logger.warn(`Redis set (sync) failed for key=${key}: ${err.message}`);
      }
      return mongoData.data;
    }
  } catch (err) {
    logger.warn(`Mongo cache read failed for key=${key}: ${err.message}`);
  }

  return null;
}

/**
 * SET CACHE
 */
export async function setCache(key, payload, ttlSeconds = DEFAULT_TTL_SECONDS) {
  if (!key) return;

  // Save in Redis
  try {
    await redis.set(key, JSON.stringify(payload), "EX", ttlSeconds);
  } catch (err) {
    logger.warn(`Redis set failed for key=${key}: ${err.message}`);
  }

  // Save in Mongo (TTL via schema)
  try {
    await RouteCache.findOneAndUpdate(
      { key },
      { key, data: payload, createdAt: new Date() },
      { upsert: true },
    );
  } catch (err) {
    logger.warn(`Mongo cache write failed for key=${key}: ${err.message}`);
  }
}
