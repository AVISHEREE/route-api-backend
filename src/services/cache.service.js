import RouteCache from "../models/RouteCache.js";
import { config } from "./config.service.js";
import { logger } from "./logger.service.js";

const DEFAULT_TTL_SECONDS = config.cache.ttl;

/**
 * GET CACHE
 */
export async function getCache(key) {
  if (!key) return null;

  // Read from Mongo cache only (Redis removed)
  try {
    const mongoData = await RouteCache.findOne({ key }).lean();
    if (mongoData) {
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
