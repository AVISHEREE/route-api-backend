import { config } from "./config.service.js";

function time() {
  return new Date().toISOString();
}

// Enable logging in production by default, or if explicitly enabled
const isLoggingEnabled = process.env.NODE_ENV === 'production' || config.logging.enabled;

export const logger = {
  info(message) {
    if (!isLoggingEnabled) return;
    console.log(`[${time()}] [INFO] ${message}`);
  },

  warn(message) {
    if (!isLoggingEnabled) return;
    console.log(`[${time()}] [WARN] ${message}`);
  },

  error(message) {
    console.log(`[${time()}] [ERROR] ${message}`);
  },
};
