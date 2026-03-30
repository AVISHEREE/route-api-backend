/*
 * redis.client.js
 *
 * PROBLEM IN YOUR LOGS:
 * ─────────────────────
 * Redis is printing "connect ECONNREFUSED 127.0.0.1:6379" every 1-2 seconds
 * because ioredis uses exponential-backoff reconnection by default, and the
 * connection event emitter floods the logger on every retry.
 *
 * THIS FIX:
 * ─────────
 * 1. Limits retries to 2 failed attempts, then stops.
 * 2. Suppresses the default "error" event logging after first failure.
 * 3. Exports a simple { get, set, del } wrapper that returns null/undefined
 *    on any failure — your cache service can continue working without Redis.
 * 4. Logs ONE warning on first failure, then stays silent.
 *
 * HOW TO USE:
 * ──────────
 * Replace your current redis client import with this file.
 * Your existing cache.service.js should already handle null returns from
 * get/set since it catches errors — this just makes it cleaner.
 */

import Redis from "ioredis";
import { logger } from "./utils/logger.js";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let client = null;
let redisAvailable = false;
let failureLogged  = false;

function createClient() {
  const c = new Redis(REDIS_URL, {
    /*
     * maxRetriesPerRequest: 0
     * ─────────────────────
     * Each get/set command fails immediately if Redis is down
     * instead of queuing and retrying. This prevents the
     * "Reached max retries per request" warning from appearing
     * on every single cache call.
     */
    maxRetriesPerRequest: 0,

    /*
     * enableOfflineQueue: false
     * ─────────────────────────
     * Commands sent while disconnected are rejected immediately
     * rather than queued forever. Your catch blocks handle this.
     */
    enableOfflineQueue: false,

    /*
     * retryStrategy
     * ─────────────
     * Called after each failed connection attempt.
     * Returning null stops reconnection entirely.
     * Here we allow 2 failed attempts then give up.
     */
    retryStrategy(times) {
      if (times >= 2) {
        if (!failureLogged) {
          logger.warn("Redis unavailable after 2 failed attempts. Cache will use MongoDB fallback.");
          failureLogged = true;
        }
        return null; // stop retrying
      }
      return 500; // wait 500ms before the final retry
    },

    /*
     * reconnectOnError
     * ────────────────
     * Only reconnect on READONLY errors (happens on Redis Cluster failover).
     * For ECONNREFUSED we let retryStrategy handle it.
     */
    reconnectOnError(err) {
      return err.message.includes("READONLY");
    },
  });

  // Suppress the default uncaught error — we handle it below
  c.on("error", (err) => {
    if (!failureLogged) {
      logger.warn(`Redis error: ${err.message}`);
    }
    // After failureLogged=true, further errors are silently swallowed
  });

  c.on("connect", () => {
    redisAvailable = true;
    failureLogged  = false;
    logger.info("Redis connected ✓");
  });

  c.on("close", () => {
    redisAvailable = false;
  });

  return c;
}

client = createClient();

/* ── Public API ─────────────────────────────────────────── */

/**
 * Get a value from Redis. Returns null if Redis is down or key missing.
 * @param {string} key
 * @returns {Promise<string|null>}
 */
export async function redisGet(key) {
  if (!redisAvailable) return null;
  try {
    return await client.get(key);
  } catch {
    return null;
  }
}

/**
 * Set a value in Redis with optional TTL (seconds).
 * @param {string} key
 * @param {string} value
 * @param {number} [ttl]  — seconds, omit for no expiry
 */
export async function redisSet(key, value, ttl) {
  if (!redisAvailable) return;
  try {
    if (ttl) {
      await client.set(key, value, "EX", ttl);
    } else {
      await client.set(key, value);
    }
  } catch {
    // Redis down — silently skip, MongoDB cache will handle it
  }
}

/**
 * Delete a key from Redis.
 */
export async function redisDel(key) {
  if (!redisAvailable) return;
  try {
    await client.del(key);
  } catch { /* silent */ }
}

export { client as redisClient };