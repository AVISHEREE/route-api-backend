import { getCache, setCache } from "../services/cache.service.js";
import { buildCacheKey } from "../utils/cacheKey.js";
import { getTrains, getStation } from "../services/trains.service.js";
import { selectRailwayHubs } from "./hub.selector.js";
import { recordRouteResult } from "../services/analytics.service.js";
import { logger } from "../services/logger.service.js";

const TRAIN_TYPE_WEIGHT = {
  RAJDHANI: 1.3,
  SHATABDI: 1.25,
  DURONTO: 1.2,
  EXPRESS: 1.0,
  PASSENGER: 0.8,
};
const DAY_MAP = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getRunningDayFromDate(dateStr) {
  const date = new Date(dateStr);
  return DAY_MAP[date.getUTCDay()];
}

function runsOnDate(train, dateStr) {
  if (!train.runningDays || !train.runningDays.length) return false;

  const day = getRunningDayFromDate(dateStr);
  return train.runningDays.includes(day);
}

function scoreTrain(train) {
  const { durationMinutes, estimatedFare, type } = train;

  if (!durationMinutes || !estimatedFare) return 0;

  const durationScore = 1 / durationMinutes;
  const fareScore = 1 / estimatedFare;

  const typeMultiplier = TRAIN_TYPE_WEIGHT[type] || 1;

  return (durationScore * 0.6 + fareScore * 0.4) * typeMultiplier;
}

function pickTopDirectTrains(trains, date, limit = 2) {
  return trains
    .filter((train) => runsOnDate(train, date))
    .map((train) => ({
      ...train,
      score: scoreTrain(train),
    }))
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function findDirectTrains(source, destination, date) {
  try {
    const cacheKey = buildCacheKey("TRAIN_DIRECT", source, destination, date);
    const cached = await getCache(cacheKey);
    if (cached) {
      return {
        found: true,
        trains: cached,
        reason: "CACHE_HIT",
      };
    }

    // Step 1: Convert city names to station codes
    let sourceStation, destinationStation;
    try {
      sourceStation = await getStation(source);
      if (!sourceStation || !sourceStation.code) {
        return {
          found: false,
          trains: [],
          reason: "SOURCE_STATION_NOT_FOUND",
        };
      }
    } catch (err) {
      logger.error(`Failed to find source station for "${source}": ${err.message}`);
      return {
        found: false,
        trains: [],
        reason: "SOURCE_STATION_LOOKUP_FAILED",
      };
    }

    try {
      destinationStation = await getStation(destination);
      if (!destinationStation || !destinationStation.code) {
        return {
          found: false,
          trains: [],
          reason: "DESTINATION_STATION_NOT_FOUND",
        };
      }
    } catch (err) {
      logger.error(`Failed to find destination station for "${destination}": ${err.message}`);
      return {
        found: false,
        trains: [],
        reason: "DESTINATION_STATION_LOOKUP_FAILED",
      };
    }

    // Step 2: Call getTrains with station codes instead of city names
    const trains = await getTrains(sourceStation.code, destinationStation.code);

    if (!trains || !trains.length) {
      return {
        found: false,
        trains: [],
        reason: "NO_DIRECT_TRAINS",
      };
    }

    const topTrains = pickTopDirectTrains(trains, date, 2);

    if (!topTrains.length) {
      return {
        found: false,
        trains: [],
        reason: "NO_TRAINS_ON_SELECTED_DATE",
      };
    }

    void recordRouteResult({
      source,
      destination,
      date,
      type: "train_direct",
      price: topTrains[0]?.estimatedFare,
      duration: topTrains[0]?.durationMinutes,
    });

    await setCache(cacheKey, topTrains);

    return {
      found: true,
      trains: topTrains,
      reason: "DIRECT_TRAINS_FOUND",
    };
  } catch (error) {
    throw new Error(`Failed to find direct trains: ${error.message}`);
  }
}

export async function findTwoIndirectTrainSegments(source, destination, date) {
  try {
    const hubResult = selectRailwayHubs(source.geo, destination.geo);
  const segments = [];
  const cacheKey = buildCacheKey(
    "TRAIN_INDIRECT",
    source.code,
    destination.code,
    date,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return {
      found: true,
      segments: cached,
      reason: "CACHE_HIT",
    };
  }

  const cleanTrain = (t) => {
    const { runningDays, score, ...rest } = t;
    return rest;
  };

  const buildSegment = async (hub, segmentType) => {
    try {
      // SOURCE → HUB
      const sToHAll = await getTrains(source.code, hub.code);
      if (!sToHAll?.length) {
        return null;
      }

      const sToH = pickTopDirectTrains(sToHAll, date, 1)[0];
      if (!sToH) {
        return null;
      }

      // HUB → DESTINATION
      const hToDAll = await getTrains(hub.code, destination.code);
      if (!hToDAll?.length) {
        return null;
      }

      const hToD = pickTopDirectTrains(hToDAll, date, 1)[0];
      if (!hToD) {
        return null;
      }

      await recordRouteResult({
        source: source.code,
        destination: destination.code,
        date,
        type: "train_indirect",
        price: (sToH.estimatedFare || 0) + (hToD.estimatedFare || 0),
        duration: (sToH.durationMinutes || 0) + (hToD.durationMinutes || 0),
      });

      return {
        segmentType,

        source: {
          code: source.code,
          name: source.name || source.code,
        },

        hub: {
          code: hub.code,
          name: hub.name,
        },

        destination: {
          code: destination.code,
          name: destination.name || destination.code,
        },

        trains: {
          sourceToHub: cleanTrain(sToH),
          hubToDestination: cleanTrain(hToD),
        },

        summary: {
          totalEstimatedFare:
            (sToH.estimatedFare || 0) + (hToD.estimatedFare || 0),

          totalDurationMinutes:
            (sToH.durationMinutes || 0) + (hToD.durationMinutes || 0),
        },
      };
    } catch (error) {
      return null;
    }
  };

  // 1️⃣ NEAR HUB SEGMENT
  if (hubResult.nearHubs?.length) {
    const nearSegment = await buildSegment(hubResult.nearHubs[0], "NEAR_HUB");
    if (nearSegment) segments.push(nearSegment);
  }

  // 2️⃣ CONNECTIVITY HUB SEGMENT
  if (hubResult.connectivityHubs?.length) {
    const connSegment = await buildSegment(
      hubResult.connectivityHubs[0],
      "CONNECTIVITY_HUB",
    );
    if (connSegment) segments.push(connSegment);
  }

  if (!segments.length) {
    return {
      found: false,
      segments: [],
      reason: "NO_INDIRECT_TRAIN_OPTIONS",
    };
  }

  return {
    found: true,
    segments,
  };
  } catch (error) {
    throw new Error(`Failed to find indirect train segments: ${error.message}`);
  }
}

// const test = async () => {
//   const result = await findDirectTrains("BIRD", "FA", "2026-01-20");
//   console.log(result);
// };

// test();

// const sourceGeo = { lat: 19.2813, lng: 73.0483 }; // Bhiwandi
// const destGeo   = { lat: 26.9124, lng: 75.7873 }; // Jaipur

// const hubs = selectRailwayHubs(
//   { lat: 19.2813, lng: 73.0483 },  // Bhiwandi
//   { lat: 26.9124, lng: 75.7873 } // Jaipur

/**
 * Process frontend-provided train data without calling external APIs
 * Filters trains by date, scores them, and returns top results
 * Reuses existing business logic: pickTopDirectTrains, recordRouteResult
 */
export async function processDirectTrains(source, destination, date, trains) {
  try {
    if (!trains || !trains.length) {
      return {
        found: false,
        trains: [],
        reason: "NO_DIRECT_TRAINS",
      };
    }

    const topTrains = pickTopDirectTrains(trains, date, 2);

    if (!topTrains.length) {
      return {
        found: false,
        trains: [],
        reason: "NO_TRAINS_ON_SELECTED_DATE",
      };
    }

    void recordRouteResult({
      source,
      destination,
      date,
      type: "train_direct",
      price: topTrains[0]?.estimatedFare,
      duration: topTrains[0]?.durationMinutes,
    });

    return {
      found: true,
      trains: topTrains,
      reason: "DIRECT_TRAINS_FOUND",
    };
  } catch (error) {
    throw new Error(`Failed to process direct trains: ${error.message}`);
  }
}
// );
// console.log(JSON.stringify(hubs, null, 2));
// const testIndirect = async () => {
//   const source = { code: "BIRD", lat: 19.2813, lng: 73.0483 };
//   const destination = { code: "JP", lat: 26.9124, lng: 75.7873 };
//   const date = "2026-01-20";

//   const result = await findTwoIndirectTrainSegments(source, destination, date);

//   console.log(JSON.stringify(result, null, 2));
// };

// testIndirect();
