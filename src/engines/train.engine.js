import { getCache, setCache } from "../services/cache.service.js";
import { logger } from "../services/logger.service.js";
import { getTrains } from "../services/trains.service.js";
import { selectRailwayHubs } from "./hub.selector.js";

const TRAIN_TYPE_WEIGHT = {
  RAJDHANI: 1.3,
  SHATABDI: 1.25,
  DURONTO: 1.2,
  EXPRESS: 1.0,
  PASSENGER: 0.8
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
  const {
    durationMinutes,
    estimatedFare,
    type
  } = train;

  if (!durationMinutes || !estimatedFare) return 0;

  const durationScore = 1 / durationMinutes;
  const fareScore = 1 / estimatedFare;

  const typeMultiplier = TRAIN_TYPE_WEIGHT[type] || 1;

  return (durationScore * 0.6 + fareScore * 0.4) * typeMultiplier;
}

function pickTopDirectTrains(trains, date, limit = 2) {
  return trains
    .filter(train => runsOnDate(train, date))
    .map(train => ({
      ...train,
      score: scoreTrain(train)
    }))
    .filter(t => t.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}


export async function findDirectTrains(source, destination, date) {
  const cacheKey = `TRAIN:DIRECT:${source}:${destination}:${date}`;

  const cached = getCache(cacheKey);
  if (cached) {
    return {
      found: true,
      trains: cached,
      reason: "CACHE_HIT"
    };
  }

  const trains = await getTrains(source, destination);

  if (!trains || !trains.length) {
    return {
      found: false,
      trains: [],
      reason: "NO_DIRECT_TRAINS"
    };
  }

  const topTrains = pickTopDirectTrains(trains, date, 2);

  if (!topTrains.length) {
    return {
      found: false,
      trains: [],
      reason: "NO_TRAINS_ON_SELECTED_DATE"
    };
  }

  setCache(cacheKey, topTrains);

  return {
    found: true,
    trains: topTrains,
    reason: "DIRECT_TRAINS_FOUND"
  };
}


export async function findTwoIndirectTrainSegments(source, destination, date) {
  const hubResult = selectRailwayHubs(source.geo, destination.geo);
  const segments = [];

  const cleanTrain = (t) => {
    const { runningDays, score, ...rest } = t;
    return rest;
  };

  const scoreSegment = (summary, segmentType) => {
    // Penalize far hubs slightly
    const hubPenalty = segmentType === "CONNECTIVITY_HUB" ? 120 : 0;

    return (
      summary.totalDurationMinutes * 0.6 +
      summary.totalEstimatedFare * 0.3 +
      hubPenalty
    );
  };

  const buildSegment = async (hub, segmentType) => {
    // SOURCE → HUB
    const sToHAll = await getTrains(source.code, hub.code);
    if (!sToHAll?.length) return null;

    const sToH = pickTopDirectTrains(sToHAll, date, 1)[0];
    if (!sToH) return null;

    // HUB → DESTINATION
    const hToDAll = await getTrains(hub.code, destination.code);
    if (!hToDAll?.length) return null;

    const hToD = pickTopDirectTrains(hToDAll, date, 1)[0];
    if (!hToD) return null;

    const summary = {
      totalEstimatedFare:
        (sToH.estimatedFare || 0) +
        (hToD.estimatedFare || 0),

      totalDurationMinutes:
        (sToH.durationMinutes || 0) +
        (hToD.durationMinutes || 0)
    };

    return {
      segmentType,
      score: scoreSegment(summary, segmentType),

      source: {
        code: source.code,
        name: source.name || source.code
      },

      hub: {
        code: hub.code,
        name: hub.name
      },

      destination: {
        code: destination.code,
        name: destination.name || destination.code
      },

      trains: {
        sourceToHub: cleanTrain(sToH),
        hubToDestination: cleanTrain(hToD)
      },

      summary
    };
  };

  // 🔹 TRY ALL NEAR HUBS (not just first)
  for (const hub of hubResult.nearHubs || []) {
    const seg = await buildSegment(hub, "NEAR_HUB");
    if (seg) segments.push(seg);
  }

  // 🔹 TRY ALL CONNECTIVITY HUBS
  for (const hub of hubResult.connectivityHubs || []) {
    const seg = await buildSegment(hub, "CONNECTIVITY_HUB");
    if (seg) segments.push(seg);
  }

  if (!segments.length) {
    return {
      found: false,
      segments: [],
      reason: "NO_INDIRECT_TRAIN_OPTIONS"
    };
  }

  // ⭐ FINAL OPTIMIZATION STEP
  segments.sort((a, b) => a.score - b.score);

  return {
    found: true,
    best: segments[0],          // ⭐ BEST (e.g. Ahmedabad)
    alternatives: segments.slice(1, 3) // optional
  };
}

