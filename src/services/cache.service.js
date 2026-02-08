import fs from "fs";
import path from "path";

const CACHE_FILE = path.resolve("../data/cache.json");
const DEFAULT_TTL = 50 * 60 * 60; // 50 hours in seconds

function readCache() {
  if (!fs.existsSync(CACHE_FILE)) return {};
  return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
}

function writeCache(data) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
}

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
  const data = cache[key];

  if (!data) return null;

  if (Date.now() > data.expiry) {
    delete cache[key];
    writeCache(cache);
    return null;
  }

  return data.value;
}
