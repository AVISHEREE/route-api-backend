import {
  selectRailwayHubs,
  selectAirportHubs,
  HUB_DATA_ex as HUB_DATA,
} from "./hub.selector.js";
import {
  findDirectTrains,
  findTwoIndirectTrainSegments,
} from "./train.engine.js";
import { findDirectBuses } from "./bus.engine.js";
import { findFlightSegment } from "./flight.engine.js";
import { logError } from "../../tp.js";
import { calculateDistance } from "../utils/distance.util.js";
import { getCache, setCache } from "../services/cache.service.js";
import { buildCacheKey } from "../utils/cacheKey.js";
import { recordRouteResult } from "../services/analytics.service.js";

//train flight v1 usefull , goated
export async function findTrainFlightSegment(source, destination, date) {
  try {
    const cacheKey = buildCacheKey(
      "SEGMENT_TRAIN_FLIGHT",
      source.code,
      destination.code,
      date,
    );
    const cached = await getCache(cacheKey);
    if (cached) return cached;
    const directDistance = calculateDistance(
      source.geo.lat,
      source.geo.lng,
      destination.geo.lat,
      destination.geo.lng,
    );

    // 🚫 DO NOT TRY TRAIN→FLIGHT FOR SHORT DISTANCES
    if (directDistance < 300) {
      return {
        found: false,
        reason: "DISTANCE_TOO_SHORT_FOR_TRAIN_FLIGHT",
        meta: { directDistance },
      };
    }

    const railwayResults = selectRailwayHubs(source.geo, destination.geo);
    const airportResults = selectAirportHubs(source.geo, destination.geo);
    // 🔹 Normalize city names (VERY IMPORTANT)
    const normalize = (s) => s.toLowerCase().replace(/\s+/g, "");

    const airportHubs = [
      ...airportResults.nearHubs,
      ...airportResults.connectivityHubs,
    ];

    const railwayHubs = [
      ...railwayResults.nearHubs,
      ...railwayResults.connectivityHubs,
    ];

    const commonHubs = railwayHubs.filter((rh) =>
      airportHubs.some((ah) => normalize(ah.city) === normalize(rh.city)),
    );

    if (!commonHubs.length) {
      return {
        found: false,
        reason: "NO_COMMON_RAIL_AIR_HUBS",
      };
    }

    const candidates = [];

    for (const hub of commonHubs) {
      let trainResult = await findDirectTrains(source.code, hub.code, date);

      if (!trainResult?.found) {
        trainResult = await findTwoIndirectTrainSegments(source, hub, date);
      }

      if (!trainResult?.found) continue;

      const train = trainResult.trains?.[0] || trainResult.best;

      const flightResult = await findFlightSegment(
        hub.geo,
        destination.geo,
        date,
      );

      if (!flightResult?.found) continue;

      const totalFare = train.estimatedFare + flightResult.segment.minPrice;

      const totalDuration =
        train.durationMinutes + flightResult.segment.minDurationMinutes;

      const score =
        totalDuration * 0.6 + totalFare * 0.3 + hub.detourRatio * 200;

      candidates.push({
        hub: hub.city,
        train,
        flight: flightResult.segment,
        summary: { totalFare, totalDuration },
        score,
      });
    }

    if (!candidates.length) {
      return {
        found: false,
        reason: "NO_VALID_TRAIN_FLIGHT_COMBINATIONS",
      };
    }

    candidates.sort((a, b) => a.score - b.score);
    const bestCandidate = candidates[0];
    void recordRouteResult({
      source: source.code,
      destination: destination.code,
      date,
      type: "train_flight_segment",
      price: bestCandidate?.summary?.totalFare,
      duration: bestCandidate?.summary?.totalDuration,
    });
    const response = {
      found: true,
      type: "TRAIN_FLIGHT_SEGMENT",
      best: candidates[0],
      alternatives: candidates.slice(1, 2),
    };
    await setCache(cacheKey, response);
    return response;
  } catch (error) {
    logError(error, "findTrainFlightSegment");
    throw error;
  }
}

//this one is goated
export async function findFlightTrainSegment(source, destination, date) {
  try {
    const cacheKey = buildCacheKey(
      "SEGMENT_FLIGHT_TRAIN",
      source.code,
      destination.code,
      date,
    );
    const cached = await getCache(cacheKey);
    if (cached) return cached;
    // 1️⃣ Select hubs near the destination (multimodal mode)
    const airportResults = selectAirportHubs(
      source.geo,
      destination.geo,
      "flight-train",
    );
    const railwayResults = selectRailwayHubs(
      source.geo,
      destination.geo,
      "flight-train",
    );

    const airportCandidates = airportResults.nearHubs; // airports ≤300 km from dest
    const railCandidates = railwayResults.connectivityHubs; // railways ≤250 km from dest

    if (!airportCandidates.length || !railCandidates.length) {
      return { found: false, reason: "NO_HUBS_FOUND" };
    }

    // Normalize city names for comparison
    const normalize = (s) => s?.toLowerCase().replace(/\s+/g, "") || "";
    const sourceCityNorm = normalize(source.city);
    const destCityNorm = normalize(destination.city);

    // Build a map: city → { airports: [], railways: [] }
    const cityMap = new Map();
    airportCandidates.forEach((airport) => {
      const key = normalize(airport.city);
      if (!cityMap.has(key)) cityMap.set(key, { airports: [], railways: [] });
      cityMap.get(key).airports.push(airport);
    });
    railCandidates.forEach((rail) => {
      const key = normalize(rail.city);
      if (!cityMap.has(key)) cityMap.set(key, { airports: [], railways: [] });
      cityMap.get(key).railways.push(rail);
    });

    // Keep only cities that have both an airport and a railway station
    const commonCities = [];
    for (const [cityKey, { airports, railways }] of cityMap.entries()) {
      if (airports.length > 0 && railways.length > 0) {
        commonCities.push({ cityKey, airports, railways });
      }
    }

    if (!commonCities.length) {
      return { found: false, reason: "NO_COMMON_HUBS_NEAR_DESTINATION" };
    }

    const routes = [];

    for (const common of commonCities) {
      // Skip if this hub city is the same as the origin city (pointless flight)
      if (common.cityKey === sourceCityNorm) {
        continue;
      }

      // Skip if this hub city is the same as the destination city
      // (we'd be flying to destination, then taking a train within the same city – unnecessary)
      if (common.cityKey === destCityNorm) {
        continue;
      }

      // Pick the best airport and railway in this city (closest to destination)
      const bestAirport = common.airports.sort(
        (a, b) => a.distToDestination - b.distToDestination,
      )[0];
      const bestRailway = common.railways.sort(
        (a, b) => a.distToDestination - b.distToDestination,
      )[0];

      // Skip if the railway station is the destination itself (no train needed)
      if (bestRailway.code === destination.code) {
        continue;
      }

      // ✈️ Flight leg: source → bestAirport
      const flightResult = await findFlightSegment(
        source.geo,
        bestAirport.geo,
        date,
      );
      if (!flightResult?.found) {
        continue;
      }
      const flight = flightResult.segment;

      // 🚆 Train leg: bestRailway → destination (try direct first)
      const trainResult = await findDirectTrains(
        bestRailway.code,
        destination.code,
        date,
      );
      if (!trainResult?.found) {
        continue; // optionally could try indirect trains, but keep simple
      }
      const train = trainResult.trains[0]; // best direct train

      // 3️⃣ Transfer time between airport and railway within the same city
      const airportRailDistance = calculateDistance(
        bestAirport.geo.lat,
        bestAirport.geo.lng,
        bestRailway.geo.lat,
        bestRailway.geo.lng,
      );
      // Assume average ground speed 30 km/h, minimum 60 minutes
      const transitMinutes = Math.max(
        60,
        Math.ceil((airportRailDistance / 30) * 60),
      );

      const totalDuration =
        (flight.minDurationMinutes || 0) +
        transitMinutes +
        (train.durationMinutes || 0);

      const totalFare = (flight.minPrice || 0) + (train.estimatedFare || 0);

      const score =
        totalDuration * 0.6 +
        totalFare * 0.3 +
        (bestAirport.priority || 1) * 20;

      routes.push({
        score,
        summary: {
          airport: bestAirport.code,
          railHub: bestRailway.code,
          city: bestAirport.city,
          totalDurationMinutes: totalDuration,
          totalFare,
          formattedDuration: `${Math.floor(totalDuration / 60)}h ${totalDuration % 60}m`,
        },
        routeDetails: [
          {
            leg: "Flight",
            from: source.code,
            to: bestAirport.code,
            carrier: flight.flightCount + " flights",
            identifier: `${flight.from.airportCode} → ${flight.to.airportCode}`,
            duration: flight.minDurationMinutes,
            fare: flight.minPrice,
            airportName: bestAirport.name,
          },
          {
            leg: `Transit within ${bestAirport.city}`,
            from: bestAirport.code,
            to: bestRailway.code,
            mode: "Taxi/Bus",
            duration: transitMinutes,
            fare: 0,
            distanceKm: Math.round(airportRailDistance),
          },
          {
            leg: "Train",
            from: bestRailway.code,
            to: destination.code,
            carrier: train.trainName,
            identifier: train.trainNumber,
            duration: train.durationMinutes,
            fare: train.estimatedFare,
            stationName: bestRailway.name,
          },
        ],
      });
    }

    if (!routes.length) {
      return { found: false, reason: "NO_VALID_COMBINATIONS" };
    }

    routes.sort((a, b) => a.score - b.score);
    const bestRoute = routes[0];
    void recordRouteResult({
      source: source.code,
      destination: destination.code,
      date,
      type: "flight_train_segment",
      price: bestRoute?.summary?.totalFare,
      duration: bestRoute?.summary?.totalDurationMinutes,
    });
    const response = {
      found: true,
      type: "FLIGHT_TRAIN_SEGMENT",
      bestRoute: routes[0],
      alternatives: routes.slice(1, 3),
    };
    await setCache(cacheKey, response);
    return response;
  } catch (error) {
    return { found: false, error: error.message };
  }
}

/**
 * BUS → FLIGHT: Source to hub by bus, then hub to destination by flight
 */
export async function findBusFlightSegment(source, destination, date) {
  try {
    const cacheKey = buildCacheKey(
      "SEGMENT_BUS_FLIGHT",
      source.code,
      destination.code,
      date,
    );
    const cached = await getCache(cacheKey);
    if (cached) return cached;
    const directDistance = calculateDistance(
      source.geo.lat,
      source.geo.lng,
      destination.geo.lat,
      destination.geo.lng,
    );

    // Skip very short distances (bus+flight makes no sense)
    if (directDistance < 300) {
      return {
        found: false,
        reason: "DISTANCE_TOO_SHORT_FOR_BUS_FLIGHT",
        meta: { directDistance },
      };
    }

    // Get all airport hubs
    const allAirports = HUB_DATA.airport_hubs || [];

    // Filter hubs within 800 km of source (reasonable bus distance)
    const hubsNearSource = allAirports
      .map((hub) => {
        const dist = calculateDistance(
          source.geo.lat,
          source.geo.lng,
          hub.geo.lat,
          hub.geo.lng,
        );
        return { ...hub, distFromSource: dist };
      })
      .filter((h) => h.distFromSource <= 800);

    if (!hubsNearSource.length) {
      return { found: false, reason: "NO_HUBS_WITHIN_BUS_RANGE" };
    }

    const normalize = (s) => s?.toLowerCase().replace(/\s+/g, "") || "";
    const sourceCityNorm = normalize(source.city);
    const destCityNorm = normalize(destination.city);

    const candidates = [];

    for (const hub of hubsNearSource) {
      // Skip if hub city is source or destination (pointless)
      const hubCityNorm = normalize(hub.city);
      if (hubCityNorm === sourceCityNorm || hubCityNorm === destCityNorm) {
        continue;
      }

      // 🚌 Bus leg: source → hub
      // Use city names for bus search (e.g., "Mumbai" or "Mumbai, Maharashtra"?)
      const busResult = await findDirectBuses(source.city, hub.city);
      if (!busResult.found) {
        continue;
      }
      const bestBus = pickBestBus(busResult);
      if (!bestBus) continue;

      // ✈️ Flight leg: hub → destination
      const flightResult = await findFlightSegment(
        hub.geo,
        destination.geo,
        date,
      );
      if (!flightResult?.found) {
        continue;
      }
      const flight = flightResult.segment;

      // Transfer time (fixed estimate)
      const transferMinutes = 60;

      const totalDuration =
        (bestBus.summary.totalDuration || 0) +
        transferMinutes +
        (flight.minDurationMinutes || 0);
      const totalFare =
        (bestBus.summary.totalEstimatedFare || 0) + (flight.minPrice || 0);
      const score = totalDuration * 0.6 + totalFare * 0.3;

      candidates.push({
        score,
        hub: hub.city,
        bus: bestBus,
        flight,
        summary: {
          totalFare,
          totalDurationMinutes: totalDuration,
          formattedDuration: `${Math.floor(totalDuration / 60)}h ${totalDuration % 60}m`,
        },
        routeDetails: [
          {
            leg: "Bus",
            from: source.city,
            to: hub.city,
            carrier: bestBus.segments?.[0]?.busName || "Bus",
            identifier: bestBus.routeKey,
            duration: bestBus.summary.totalDuration,
            fare: bestBus.summary.totalEstimatedFare,
            details: bestBus.segments,
          },
          {
            leg: `Transfer in ${hub.city}`,
            from: "Bus station",
            to: "Airport",
            mode: "Taxi/Bus",
            duration: transferMinutes,
            fare: 0,
            note: "Estimated transfer time",
          },
          {
            leg: "Flight",
            from: flight.from.airportCode,
            to: flight.to.airportCode,
            carrier: flight.flightCount + " flights",
            identifier: `${flight.from.airportCode} → ${flight.to.airportCode}`,
            duration: flight.minDurationMinutes,
            fare: flight.minPrice,
            airportName: flight.from.airportName,
          },
        ],
      });
    }

    if (!candidates.length) {
      return { found: false, reason: "NO_VALID_BUS_FLIGHT_COMBINATIONS" };
    }

    candidates.sort((a, b) => a.score - b.score);
    const bestCandidate = candidates[0];
    void recordRouteResult({
      source: source.code,
      destination: destination.code,
      date,
      type: "bus_flight_segment",
      price: bestCandidate?.summary?.totalFare,
      duration: bestCandidate?.summary?.totalDurationMinutes,
    });
    const response = {
      found: true,
      type: "BUS_FLIGHT_SEGMENT",
      best: candidates[0],
      alternatives: candidates.slice(1, 3),
    };
    await setCache(cacheKey, response);
    return response;
  } catch (error) {
    return { found: false, error: error.message };
  }
}

/**
 * FLIGHT → BUS: Source to hub by flight, then hub to destination by bus
 */
// export async function findFlightBusSegment(source, destination, date) {
//   try {
//     const directDistance = calculateDistance(
//       source.geo.lat, source.geo.lng,
//       destination.geo.lat, destination.geo.lng
//     );

//     if (directDistance < 300) {
//       return {
//         found: false,
//         reason: "DISTANCE_TOO_SHORT_FOR_FLIGHT_BUS",
//         meta: { directDistance }
//       };
//     }

//     const allAirports = HUB_DATA_ex.airport_hubs || [];

//     // Filter hubs within 800 km of destination (bus leg from hub to destination)
//     const hubsNearDest = allAirports
//       .map(hub => {
//         const dist = calculateDistance(
//           destination.geo.lat, destination.geo.lng,
//           hub.geo.lat, hub.geo.lng
//         );
//         return { ...hub, distToDestination: dist };
//       })
//       .filter(h => h.distToDestination <= 800);

//     if (!hubsNearDest.length) {
//       return { found: false, reason: "NO_HUBS_WITHIN_BUS_RANGE" };
//     }

//     const normalize = (s) => s?.toLowerCase().replace(/\s+/g, "") || "";
//     const sourceCityNorm = normalize(source.city);
//     const destCityNorm = normalize(destination.city);

//     const candidates = [];

//     for (const hub of hubsNearDest) {
//       const hubCityNorm = normalize(hub.city);
//       if (hubCityNorm === sourceCityNorm || hubCityNorm === destCityNorm) {
//         continue;
//       }

//       // ✈️ Flight leg: source → hub
//       const flightResult = await findFlightSegment(source.geo, hub.geo, date);
//       if (!flightResult?.found) {
//         continue;
//       }
//       const flight = flightResult.segment;

//       // 🚌 Bus leg: hub → destination
//       const busResult = await findDirectBuses(hub.city, destination.city);
//       if (!busResult.found) {
//         continue;
//       }
//       const bestBus = pickBestBus(busResult);
//       if (!bestBus) continue;

//       const transferMinutes = 60;

//       const totalDuration = (flight.minDurationMinutes || 0) + transferMinutes + (bestBus.summary.totalDuration || 0);
//       const totalFare = (flight.minPrice || 0) + (bestBus.summary.totalEstimatedFare || 0);
//       const score = totalDuration * 0.6 + totalFare * 0.3;

//       candidates.push({
//         score,
//         hub: hub.city,
//         flight,
//         bus: bestBus,
//         summary: {
//           totalFare,
//           totalDurationMinutes: totalDuration,
//           formattedDuration: `${Math.floor(totalDuration / 60)}h ${totalDuration % 60}m`
//         },
//         routeDetails: [
//           {
//             leg: "Flight",
//             from: flight.from.airportCode,
//             to: flight.to.airportCode,
//             carrier: flight.flightCount + " flights",
//             identifier: `${flight.from.airportCode} → ${flight.to.airportCode}`,
//             duration: flight.minDurationMinutes,
//             fare: flight.minPrice,
//             airportName: flight.from.airportName
//           },
//           {
//             leg: `Transfer in ${hub.city}`,
//             from: "Airport",
//             to: "Bus station",
//             mode: "Taxi/Bus",
//             duration: transferMinutes,
//             fare: 0,
//             note: "Estimated transfer time"
//           },
//           {
//             leg: "Bus",
//             from: hub.city,
//             to: destination.city,
//             carrier: bestBus.segments?.[0]?.busName || "Bus",
//             identifier: bestBus.routeKey,
//             duration: bestBus.summary.totalDuration,
//             fare: bestBus.summary.totalEstimatedFare,
//             details: bestBus.segments
//           }
//         ]
//       });
//     }

//     if (!candidates.length) {
//       return { found: false, reason: "NO_VALID_FLIGHT_BUS_COMBINATIONS" };
//     }

//     candidates.sort((a, b) => a.score - b.score);

//     return {
//       found: true,
//       best: candidates[0],
//       alternatives: candidates.slice(1, 3)
//     };

//   } catch (error) {
//     return { found: false, error: error.message };
//   }
// }

// segment.engine.js – add these functions

// Reuse the bus picker from bus+flight (or define it here)

function pickBestBus(busResult) {
  if (!busResult.found || !busResult.routes.length) return null;
  const sorted = [...busResult.routes].sort((a, b) => {
    const durA = a.summary.totalDuration || Infinity;
    const durB = b.summary.totalDuration || Infinity;
    if (durA !== durB) return durA - durB;
    return (
      (a.summary.totalEstimatedFare || 0) - (b.summary.totalEstimatedFare || 0)
    );
  });
  return sorted[0];
}
function parseDurationToMinutes(durationStr) {
  if (!durationStr || typeof durationStr !== "string") return 0;
  const lower = durationStr.toLowerCase();
  let total = 0;
  const hourMatch = lower.match(/(\d+)\s*(hours?|h)/);
  const minMatch = lower.match(/(\d+)\s*(minutes?|mins?|m)/);
  if (hourMatch) total += parseInt(hourMatch[1]) * 60;
  if (minMatch) total += parseInt(minMatch[1]);
  return total;
}

/**
 * TRAIN → BUS: Source to hub by train, then hub to destination by bus
 */
export async function findTrainBusSegment(source, destination, date) {
  try {
    const cacheKey = buildCacheKey(
      "SEGMENT_TRAIN_BUS",
      source.code,
      destination.code,
      date,
    );
    const cached = await getCache(cacheKey);
    if (cached) return cached;
    const directDistance = calculateDistance(
      source.geo.lat,
      source.geo.lng,
      destination.geo.lat,
      destination.geo.lng,
    );

    if (directDistance < 200) {
      return {
        found: false,
        reason: "DISTANCE_TOO_SHORT_FOR_TRAIN_BUS",
        meta: { directDistance },
      };
    }

    const normalize = (s) => s?.toLowerCase().replace(/\s+/g, "") || "";

    // ── Candidate hubs ──────────────────────────────────────────────────────
    const allRailway = HUB_DATA.railway_hubs || [];
    const candidateHubs = allRailway
      .map((hub) => ({
        ...hub,
        distFromSource: calculateDistance(
          source.geo.lat,
          source.geo.lng,
          hub.geo.lat,
          hub.geo.lng,
        ),
        distToDestination: calculateDistance(
          destination.geo.lat,
          destination.geo.lng,
          hub.geo.lat,
          hub.geo.lng,
        ),
      }))
      .filter((h) => h.distFromSource <= 2000 && h.distToDestination <= 800)
      // FIX #2 (rate-limit) — sort so the most promising hubs go first.
      // We try the closest hubs first and stop early once we have enough
      // candidates, dramatically reducing total API calls.
      .sort(
        (a, b) =>
          a.distFromSource +
          a.distToDestination -
          (b.distFromSource + b.distToDestination),
      )
      // FIX #2 cont. — hard-cap at 8 hubs max. 18 hubs × 5 calls = 90 requests
      // which blows past any reasonable rate limit. 8 × 5 = 40 max calls.
      .slice(0, 8);

    if (!candidateHubs.length) {
      return { found: false, reason: "NO_HUBS_WITHIN_RANGE" };
    }

    const sourceCityNorm = normalize(source.city);
    const destCityNorm = normalize(destination.city);
    const candidates = [];

    for (const hub of candidateHubs) {
      const hubCityNorm = normalize(hub.city);
      if (hubCityNorm === sourceCityNorm || hubCityNorm === destCityNorm)
        continue;

      // ── Train leg: source → hub ───────────────────────────────────────────
      let trainResult;
      try {
        trainResult = await findDirectTrains(source.code, hub.code, date);

        if (!trainResult?.found) {
          // FIX #1 — selectRailwayHubs inside findTwoIndirectTrainSegments
          // expects plain { lat, lng } objects, not the full source object.
          // Pass source.geo explicitly so sourceGeo.lat is never undefined.
          trainResult = await findTwoIndirectTrainSegments(
            {
              code: source.code,
              geo: source.geo,
              name: source.name ?? source.code,
            },
            { code: hub.code, geo: hub.geo, name: hub.name },
            date,
          );
        }
      } catch (err) {
        // FIX #2 — if it's a 429 we've hit the rate limit; no point hammering
        // more hubs right now. Break out entirely and return what we have.
        if (err?.response?.status === 429 || err?.status === 429) {
          break;
        }
        // Any other error (network blip, etc.) — skip just this hub
        continue;
      }

      if (!trainResult?.found) continue;

      // FIX #1 cont. — indirect results return
      // { segments: [{ trains: { sourceToHub, hubToDestination } }] }
      // not .trains[] or .best, so both shapes must be handled.
      const train = resolveTrainFromResult(trainResult);
      if (!train?.durationMinutes || !train?.estimatedFare) continue;

      // ── Bus leg: hub city → destination city ──────────────────────────────
      let busResult;
      try {
        busResult = await findDirectBuses(hub.city, destination.city);
      } catch (err) {
        if (err?.response?.status === 429 || err?.status === 429) {
          break;
        }
        continue;
      }

      if (!busResult?.found) continue;

      const bestBus = pickBestBus(busResult);
      if (!bestBus) continue;

      const busDuration = parseDurationToMinutes(
        bestBus.summary?.totalDuration,
      );
      const busFare = bestBus.summary?.totalEstimatedFare || 0;
      if (busDuration === 0) continue;

      const transferMinutes = 60;
      const totalDuration =
        (train.durationMinutes || 0) + transferMinutes + busDuration;
      const totalFare = (train.estimatedFare || 0) + busFare;
      const score = totalDuration * 0.6 + totalFare * 0.3;

      candidates.push({
        score,
        hub: hub.city,
        train,
        bus: bestBus,
        summary: {
          totalFare,
          totalDurationMinutes: totalDuration,
          formattedDuration: `${Math.floor(totalDuration / 60)}h ${totalDuration % 60}m`,
        },
        routeDetails: [
          {
            leg: "Train",
            from: source.code,
            to: hub.code,
            carrier: train.trainName,
            identifier: train.trainNumber,
            duration: train.durationMinutes,
            fare: train.estimatedFare,
            stationName: hub.name,
          },
          {
            leg: `Transfer in ${hub.city}`,
            from: "Railway station",
            to: "Bus station",
            mode: "Taxi/Bus",
            duration: transferMinutes,
            fare: 0,
          },
          {
            leg: "Bus",
            from: hub.city,
            to: destination.city,
            carrier: bestBus.segments?.[0]?.busName || "Bus",
            identifier: bestBus.routeKey,
            duration: busDuration,
            fare: busFare,
            details: bestBus.segments,
          },
        ],
      });

      // FIX #2 cont. — stop as soon as we have 2 good candidates.
      // No need to exhaust all 8 hubs once we have enough to return best + 1 alt.
      if (candidates.length >= 2) break;
    }

    if (!candidates.length) {
      return { found: false, reason: "NO_VALID_TRAIN_BUS_COMBINATIONS" };
    }

    candidates.sort((a, b) => a.score - b.score);
    const bestCandidate = candidates[0];
    void recordRouteResult({
      source: source.code,
      destination: destination.code,
      date,
      type: "train_bus_segment",
      price: bestCandidate?.summary?.totalFare,
      duration: bestCandidate?.summary?.totalDurationMinutes,
    });
    const response = {
      found: true,
      type: "TRAIN_BUS_SEGMENT",
      best: candidates[0],
      alternatives: candidates.slice(1, 2),
    };
    await setCache(cacheKey, response);
    return response;
  } catch (error) {
    return { found: false, error: error.message };
  }
}

// ─── Private helper ────────────────────────────────────────────────────────
// Handles both result shapes from train engines:
//   Direct:   { found, trains: [train] }
//   Indirect: { found, segments: [{ trains: { sourceToHub, hubToDestination } }] }
function resolveTrainFromResult(result) {
  if (result.trains?.[0]) return result.trains[0];

  const seg = result.segments?.[0];
  const s2h = seg?.trains?.sourceToHub;
  const h2d = seg?.trains?.hubToDestination;
  if (!s2h || !h2d) return null;

  return {
    trainName: `${s2h.trainName} + ${h2d.trainName}`,
    trainNumber: `${s2h.trainNumber} / ${h2d.trainNumber}`,
    durationMinutes: (s2h.durationMinutes || 0) + (h2d.durationMinutes || 0),
    estimatedFare: (s2h.estimatedFare || 0) + (h2d.estimatedFare || 0),
    type: s2h.type,
    via: seg.hub?.code,
  };
}
/**
 * BUS → TRAIN: Source to hub by bus, then hub to destination by train
 */
// export async function findBusTrainSegment(source, destination, date) {
//   try {
//     const directDistance = calculateDistance(
//       source.geo.lat, source.geo.lng,
//       destination.geo.lat, destination.geo.lng
//     );

//     if (directDistance < 200) {
//       return {
//         found: false,
//         reason: "DISTANCE_TOO_SHORT_FOR_BUS_TRAIN",
//         meta: { directDistance }
//       };
//     }

//     const allRailway = HUB_DATA_ex.railway_hubs || [];

//     // Filter hubs within bus range from source (800 km) and train range to destination (2000 km)
//     const candidateHubs = allRailway
//       .map(hub => {
//         const distFromSource = calculateDistance(
//           source.geo.lat, source.geo.lng,
//           hub.geo.lat, hub.geo.lng
//         );
//         const distToDestination = calculateDistance(
//           destination.geo.lat, destination.geo.lng,
//           hub.geo.lat, hub.geo.lng
//         );
//         return { ...hub, distFromSource, distToDestination };
//       })
//       .filter(h => h.distFromSource <= 800 && h.distToDestination <= 2000);

//     if (!candidateHubs.length) {
//       return { found: false, reason: "NO_HUBS_WITHIN_RANGE" };
//     }

//     const normalize = (s) => s?.toLowerCase().replace(/\s+/g, "") || "";
//     const sourceCityNorm = normalize(source.city);
//     const destCityNorm = normalize(destination.city);

//     const candidates = [];

//     for (const hub of candidateHubs) {
//       const hubCityNorm = normalize(hub.city);
//       if (hubCityNorm === sourceCityNorm || hubCityNorm === destCityNorm) {
//         continue;
//       }

//       // 🚌 Bus leg: source city → hub city
//       const busResult = await findDirectBuses(source.city, hub.city);
//       if (!busResult.found) {
//         continue;
//       }
//       const bestBus = pickBestBus(busResult);
//       if (!bestBus) continue;

//       // 🚆 Train leg: hub → destination (direct then indirect)
//       let trainResult = await findDirectTrains(hub.code, destination.code, date);
//       if (!trainResult?.found) {
//         trainResult = await findTwoIndirectTrainSegments(hub, destination, date);
//       }
//       if (!trainResult?.found) {
//         continue;
//       }
//       const train = trainResult.trains?.[0] || trainResult.best;

//       const transferMinutes = 60;

//       const totalDuration = (bestBus.summary.totalDuration || 0) + transferMinutes + (train.durationMinutes || 0);
//       const totalFare = (bestBus.summary.totalEstimatedFare || 0) + (train.estimatedFare || 0);
//       const score = totalDuration * 0.6 + totalFare * 0.3;

//       candidates.push({
//         score,
//         hub: hub.city,
//         bus: bestBus,
//         train,
//         summary: {
//           totalFare,
//           totalDurationMinutes: totalDuration,
//           formattedDuration: `${Math.floor(totalDuration / 60)}h ${totalDuration % 60}m`
//         },
//         routeDetails: [
//           {
//             leg: "Bus",
//             from: source.city,
//             to: hub.city,
//             carrier: bestBus.segments?.[0]?.busName || "Bus",
//             identifier: bestBus.routeKey,
//             duration: bestBus.summary.totalDuration,
//             fare: bestBus.summary.totalEstimatedFare,
//             details: bestBus.segments
//           },
//           {
//             leg: `Transfer in ${hub.city}`,
//             from: "Bus station",
//             to: "Railway station",
//             mode: "Taxi/Bus",
//             duration: transferMinutes,
//             fare: 0,
//             note: "Estimated transfer time"
//           },
//           {
//             leg: "Train",
//             from: hub.code,
//             to: destination.code,
//             carrier: train.trainName,
//             identifier: train.trainNumber,
//             duration: train.durationMinutes,
//             fare: train.estimatedFare,
//             stationName: hub.name
//           }
//         ]
//       });
//     }

//     if (!candidates.length) {
//       return { found: false, reason: "NO_VALID_BUS_TRAIN_COMBINATIONS" };
//     }

//     candidates.sort((a, b) => a.score - b.score);

//     return {
//       found: true,
//       best: candidates[0],
//       alternatives: candidates.slice(1, 3)
//     };

//   } catch (error) {
//     return { found: false, error: error.message };
//   }
// }
