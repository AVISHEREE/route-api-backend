import {selectRailwayHubs,selectAirportHubs} from './hub.selector.js'
import { findDirectTrains, findTwoIndirectTrainSegments } from './train.engine.js';
import {findFlightSegment} from './flight.engine.js'
import { logError } from '../../tp.js';
import { distanceKm } from '../utils/geo.js';

export async function findTrainFlightSegment(source, destination, date) {
  try {
    // ─────────────────────────────────────────────
    // Defensive geo validation (no behavior change)
    // ─────────────────────────────────────────────
    if (!source?.geo || !destination?.geo) {
      throw new Error("Missing geo data for source or destination");
    }

    const railwayResults = selectRailwayHubs(source.geo, destination.geo);
    const airportResults = selectAirportHubs(source.geo, destination.geo);

    // ─────────────────────────────────────────────
    // Collect hubs
    // ─────────────────────────────────────────────
    const airportHubs = [
      ...airportResults.nearHubs,
      ...airportResults.connectivityHubs
    ];

    const railwayHubs = [
      ...railwayResults.nearHubs,
      ...railwayResults.connectivityHubs
    ];

    const normalize = (s) =>
      s.toLowerCase().replace(/\s+/g, "");

    const commonHubs = railwayHubs.filter(rh =>
      airportHubs.some(ah =>
        normalize(ah.city) === normalize(rh.city)
      )
    );

    if (!commonHubs.length) {
      return {
        found: false,
        reason: "NO_COMMON_RAIL_AIR_HUBS"
      };
    }

    // ─────────────────────────────────────────────
    // Scoring weights (easy to tune later)
    // ─────────────────────────────────────────────
    const WEIGHTS = {
      duration: 0.6,
      fare: 0.3,
      detour: 0.1
    };

    const candidates = [];

    // ─────────────────────────────────────────────
    // Evaluate ALL hubs
    // ─────────────────────────────────────────────
    for (const hub of commonHubs) {

      // TRAIN: source → hub
      let trainResult = await findDirectTrains(
        source.code,
        hub.code,
        date
      );

      if (!trainResult?.found) {
        trainResult = await findTwoIndirectTrainSegments(
          source,
          hub,
          date
        );
      }

      if (!trainResult?.found) {
        continue; // no train path for this hub
      }

      const train =
        trainResult.trains?.[0] || trainResult.best;

      // FLIGHT: hub → destination
      const flightResult = await findFlightSegment(hub.geo, destination.geo, date);

      if (!flightResult?.found) {
        continue; // no flight from this hub
      }

      const totalFare =
        (train.estimatedFare || 0) +
        (flightResult.segment.minPrice || 0);

      const totalDuration =
        (train.durationMinutes || 0) +
        (flightResult.segment.minDurationMinutes || 0);

      const score =
        totalDuration * WEIGHTS.duration +
        totalFare * WEIGHTS.fare +
        (hub.distFromSource || 0) * WEIGHTS.detour;

      candidates.push({
        hub: hub.city,
        hubCode: hub.code,
        train,
        flight: flightResult.segment,
        summary: {
          totalFare,
          totalDuration
        },
        score
      });
    }

    // ─────────────────────────────────────────────
    // Final decision
    // ─────────────────────────────────────────────
    if (!candidates.length) {
      return {
        found: false,
        reason: "NO_VALID_TRAIN_FLIGHT_COMBINATIONS"
      };
    }

    candidates.sort((a, b) => a.score - b.score);

    return {
      found: true,
      best: candidates[0],
      alternatives: candidates.slice(1, 3)
    };

  } catch (error) {
    logError(error, "findTrainFlightSegment");
    throw error;
  }
}

export async function findFlightTrainSegment(source, destination, date) {
  try {
    // ─────────────────────────────────────────────
    // Defensive geo validation
    // ─────────────────────────────────────────────
    if (!source?.geo || !destination?.geo) {
      throw new Error("Missing geo data for source or destination");
    }

    const airportResults = selectAirportHubs(source.geo, destination.geo);
    const railwayResults = selectRailwayHubs(source.geo, destination.geo);

    // ─────────────────────────────────────────────
    // Collect hubs
    // ─────────────────────────────────────────────
    const airportHubs = [
      ...airportResults.nearHubs,
      ...airportResults.connectivityHubs
    ];

    const railwayHubs = [
      ...railwayResults.nearHubs,
      ...railwayResults.connectivityHubs
    ];
    // console.log("Airport hubs :",airportHubs)
    // console.log("Railway hubs :",railwayHubs)
    const normalize = (s) =>
      s.toLowerCase().replace(/\s+/g, "");

    const commonHubs = airportHubs.filter(ah =>
      railwayHubs.some(rh =>
        normalize(rh.city) === normalize(ah.city)
      )
    );
    console.log(commonHubs); 
    if (!commonHubs.length) {
      return {
        found: false,
        reason: "NO_COMMON_AIR_RAIL_HUBS"
      };
    }

    // ─────────────────────────────────────────────
    // Scoring weights
    // ─────────────────────────────────────────────
    const WEIGHTS = {
      duration: 0.6,
      fare: 0.3,
      detour: 0.1
    };

    const candidates = [];

    // ─────────────────────────────────────────────
    // Evaluate ALL hubs (FLIGHT → TRAIN)
    // ─────────────────────────────────────────────
    for (const hub of commonHubs) {

      // FLIGHT: source → hub
      const flightResult =  await findFlightSegment(
        source.geo,
        hub.geo,
        date
      );
      if (!flightResult?.found) {
        continue; // no flight to this hub
      }

      const flight = flightResult. segment;

      // TRAIN: hub → destination
      let trainResult = await findDirectTrains(
        hub.code,
        destination.code,
        date
      );
      console.log(trainResult)
      if (!trainResult?.found) {
        trainResult = await findTwoIndirectTrainSegments(
          hub,
          destination,
          date
        );
      }

      if (!trainResult?.found) {
        continue; // no train from this hub
      }

      const train =
        trainResult.trains?.[0] || trainResult.best;

      const totalFare =
        (flight.minPrice || 0) +
        (train.estimatedFare || 0);

      const totalDuration =
        (flight.minDurationMinutes || 0) +
        (train.durationMinutes || 0);

      const score =
        totalDuration * WEIGHTS.duration +
        totalFare * WEIGHTS.fare +
        (hub.distFromSource || 0) * WEIGHTS.detour;

      candidates.push({
        hub: hub.city,
        hubCode: hub.code,
        flight,
        train,
        summary: {
          totalFare,
          totalDuration
        },
        score
      });
    }

    // ─────────────────────────────────────────────
    // Final decision
    // ─────────────────────────────────────────────
    if (!candidates.length) {
      return {
        found: false,
        reason: "NO_VALID_FLIGHT_TRAIN_COMBINATIONS"
      };
    }

    candidates.sort((a, b) => a.score - b.score);

    return {
      found: true,
      best: candidates[0],
      alternatives: candidates.slice(1, 3)
    };

  } catch (error) {
    logError(error, "findFlightTrainSegment");
    throw error;
  }
}

