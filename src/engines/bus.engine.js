import { getCache, setCache } from "../services/cache.service.js";
import { buildCacheKey } from "../utils/cacheKey.js";
import { getBusRoutesService } from "../services/bus.service.js";
import { recordRouteResult } from "../services/analytics.service.js";
/**
 * Create a stable key for deduplication
 */
function buildRouteKey(buses = []) {
  return buses.map((b) => `${b.fromStop}→${b.toStop}`).join("|");
}

/**
 * Normalize time text (optional safety)
 */
function normalizeTime(t) {
  if (!t) return null;
  return t.replace(/\u202F/g, " ").trim(); // remove weird unicode spaces
}

function parseDurationToMinutes(durationStr) {
  if (!durationStr || typeof durationStr !== "string") return null;
  const lower = durationStr.toLowerCase();
  let total = 0;
  const hourMatch = lower.match(/(\d+)\s*(hours?|hrs?|h)/);
  const minMatch = lower.match(/(\d+)\s*(minutes?|mins?|m)/);
  if (hourMatch) total += parseInt(hourMatch[1], 10) * 60;
  if (minMatch) total += parseInt(minMatch[1], 10);
  return total || null;
}

export async function findDirectBuses(origin, destination, limit = 3) {
  try {
    const cacheKey = buildCacheKey("BUS_DIRECT", origin, destination, "NA");
    const cached = await getCache(cacheKey);
    if (cached) {
      return {
        found: true,
        routes: cached,
        reason: "CACHE_HIT",
      };
    }
    const routes = await getBusRoutesService(origin, destination);

    if (!routes || routes.length === 0) {
      return {
        found: false,
        routes: [],
        reason: "NO_BUSES_FOUND",
      };
    }

    const routeMap = new Map();

    for (const route of routes) {
      if (!route.buses || route.buses.length === 0) continue;

      const routeKey = buildRouteKey(route.buses);

      // Deduplicate identical routes
      if (routeMap.has(routeKey)) continue;

      const totalEstimatedFare = route.buses.reduce(
        (sum, b) => sum + (b.estimatedFare || 0),
        0,
      );

      routeMap.set(routeKey, {
        routeKey: routeKey.replace(/\|/g, " → "),
        summary: {
          totalDistance: route.totalDistance,
          totalDuration: route.totalDuration,
          changes: route.buses.length - 1,
          totalEstimatedFare,
        },
        segments: route.buses.map((bus) => ({
          busName: bus.busName,
          busNumber: bus.busNumber,
          from: bus.fromStop,
          to: bus.toStop,
          departureTime: normalizeTime(bus.departureTime),
          arrivalTime: normalizeTime(bus.arrivalTime),
          duration: bus.duration,
          distance: bus.distance,
          estimatedFare: bus.estimatedFare,
        })),
      });
    }

    const uniqueRoutes = Array.from(routeMap.values()).slice(0, limit);

    if (!uniqueRoutes.length) {
      return {
        found: false,
        routes: [],
        reason: "NO_VALID_BUSES",
      };
    }

    const bestRoute = uniqueRoutes[0];
    void recordRouteResult({
      source: origin,
      destination,
      date: "NA",
      type: "bus_direct",
      price: bestRoute?.summary?.totalEstimatedFare,
      duration: parseDurationToMinutes(bestRoute?.summary?.totalDuration),
    });

    await setCache(cacheKey, uniqueRoutes);
    return {
      found: true,
      routes: uniqueRoutes,
      reason: "BUSES_FOUND",
    };
  } catch (error) {
    return {
      found: false,
      routes: [],
      reason: "BUS_SERVICE_ERROR",
      error: error.message,
    };
  }
}
// const testDirectBus = async () => {
//   const result = await findDirectBuses(
//     "Bhiwandi, Maharashtra",
//     "Falna, Rajasthan"
//   );

//   console.log(JSON.stringify(result, null, 2));
// };

// testDirectBus();
