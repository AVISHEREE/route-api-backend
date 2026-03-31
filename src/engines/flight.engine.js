import { searchFlights } from "../services/flights.service.js";
import { selectAirportHubs } from "./hub.selector.js";
import { getCache, setCache } from "../services/cache.service.js";
import { buildCacheKey } from "../utils/cacheKey.js";
import { recordRouteResult } from "../services/analytics.service.js";

function pickBestHub(hubResult) {
  if (hubResult.nearHubs?.length > 0) {
    return { hub: hubResult.nearHubs[0], type: "NEAR" };
  }
  if (hubResult.connectivityHubs?.length > 0) {
    return { hub: hubResult.connectivityHubs[0], type: "CONNECTIVITY" };
  }
  return null;
}

function buildAirportAddress(hub) {
  return `${hub.name}, ${hub.city}, ${hub.state}, India`;
}

/**
 * Check if a flight segment exists between source & destination
 */
export async function findFlightSegment(
  sourceGeo,
  destinationGeo,
  outboundDate,
) {
  const sourceHubResult = selectAirportHubs(sourceGeo, destinationGeo);
  const sourcePick = pickBestHub(sourceHubResult);
  if (!sourcePick) {
    return { found: false, reason: "NO_SOURCE_HUB" };
  }

  const destHubResult = selectAirportHubs(destinationGeo, sourceGeo);
  const destPick = pickBestHub(destHubResult);
  if (!destPick) {
    return { found: false, reason: "NO_DEST_HUB" };
  }

  const cacheKey = buildCacheKey(
    "FLIGHT_SEGMENT",
    sourcePick.hub.code,
    destPick.hub.code,
    outboundDate,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return cached;
  }

  const flights = await searchFlights({
    source: sourcePick.hub.code,
    destination: destPick.hub.code,
    outboundDate,
    type: 2,
    sort: "best",
  });

  if (!flights || flights.length === 0) {
    return { found: false, reason: "NO_FLIGHT_SEGMENT" };
  }

  const prices = flights.map((f) => f.price).filter(Boolean);
  const durations = flights.map((f) => f.durationMinutes).filter(Boolean);
  if (!prices.length || !durations.length) {
    return { found: false, reason: "INVALID_FLIGHT_DATA" };
  }

  const minPrice = Math.min(...prices);
  const minDurationMinutes = Math.min(...durations);

  void recordRouteResult({
    source: sourcePick.hub.code,
    destination: destPick.hub.code,
    date: outboundDate,
    type: "flight_segment",
    price: minPrice,
    duration: minDurationMinutes,
  });

  const response = {
    found: true,
    type: "FLIGHT_SEGMENT",
    segment: {
      from: {
        airportCode: sourcePick.hub.code,
        airportName: sourcePick.hub.name,
        address: buildAirportAddress(sourcePick.hub),
        city: sourcePick.hub.city,
        state: sourcePick.hub.state,
      },
      to: {
        airportCode: destPick.hub.code,
        airportName: destPick.hub.name,
        address: buildAirportAddress(destPick.hub),
        city: destPick.hub.city,
        state: destPick.hub.state,
      },
      sourceHubType: sourcePick.type,
      destinationHubType: destPick.type,
      flightCount: flights.length,
      minPrice,
      minDurationMinutes,
    },
    reason: "FLIGHT_SEGMENT_AVAILABLE",
  };

  await setCache(cacheKey, response);
  return response;
}
