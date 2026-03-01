export function buildCacheKey(type, source, destination, date) {
  return `${type}:${source}:${destination}:${date}`;
}