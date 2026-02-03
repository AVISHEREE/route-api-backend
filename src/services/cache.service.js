import fs from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Absolute path to cache file
 * src/data/cache.json
 */
const CACHE_FILE_PATH = join(__dirname, "..", "data", "cache.json");

const DEFAULT_TTL = 50 * 60 * 60; // 50 hours (seconds)

/* =====================================================
   INTERNAL HELPERS
   ===================================================== */

function ensureCacheFile() {
  if (!fs.existsSync(CACHE_FILE_PATH)) {
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify({}, null, 2));
  }
}

function readCache() {
  ensureCacheFile();
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function writeCache(data) {
  fs.writeFileSync(
    CACHE_FILE_PATH,
    JSON.stringify(data, null, 2)
  );
}

/* =====================================================
   PUBLIC API
   ===================================================== */

export function setCache(key, value, ttl = DEFAULT_TTL) {
  const cache = readCache();

  cache[key] = {
    value,
    expiry: Date.now() + ttl * 1000
  };

  writeCache(cache);
}

export function getCache(key) {
  const cache = readCache();
  const entry = cache[key];

  if (!entry) return null;

  if (Date.now() > entry.expiry) {
    delete cache[key];
    writeCache(cache);
    return null;
  }

  return entry.value;
}
