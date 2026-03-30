import { logger } from "../services/logger.service.js";

// Redis has been intentionally removed.
// This is a no-op cache fallback so the app continues running without Redis.
const noOp = async () => null;

export const redis = {
  get: noOp,
  set: async () => {},
  del: async () => {},
};

logger.info("Redis support is disabled. Redis calls are no-op.");
