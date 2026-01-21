import { config } from "./config.service.js";

function time() {
  return new Date().toISOString();
}

export const logger = {
  info(message) {
    if (!config.logging.enabled) return;
    console.log(`[${time()}] [INFO] ${message}`);
  },

  warn(message) {
    if (!config.logging.enabled) return;
    console.log(`[${time()}] [WARN] ${message}`);
  },

  error(message) {
    console.log(`[${time()}] [ERROR] ${message}`);
  },
};
