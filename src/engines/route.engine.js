import {selectRailwayHubs,selectAirportHubs} from './hub.selector.js'
import { findDirectTrains, findTwoIndirectTrainSegments } from './train.engine.js';
import {findFlightSegment} from './flight.engine.js'
import { logError } from '../../tp.js';
import { distanceKm } from '../utils/geo.js';
export async function findTrainFlightSegment(source, destination, date) {
  try {
    const directDistance = distanceKm(
      source.geo.lat,
      source.geo.lng,
      destination.geo.lat,
      destination.geo.lng
    );

    // 🚫 DO NOT TRY TRAIN→FLIGHT FOR SHORT DISTANCES
    if (directDistance < 600) {
      return {
        found: false,
        reason: "DISTANCE_TOO_SHORT_FOR_TRAIN_FLIGHT",
        meta: { directDistance }
      };
    }

    const railwayResults = selectRailwayHubs(source.geo, destination.geo);
    const airportResults = selectAirportHubs(source.geo, destination.geo);

    // 🔹 Normalize city names (VERY IMPORTANT)
    const normalize = (s) => s.toLowerCase().replace(/\s+/g, "");

    const airportHubs = [
      ...airportResults.nearHubs,
      ...airportResults.connectivityHubs
    ];

    const railwayHubs = [
      ...railwayResults.nearHubs,
      ...railwayResults.connectivityHubs
    ];

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

    const candidates = [];

    for (const hub of commonHubs) {
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

      if (!trainResult?.found) continue;

      const train =
        trainResult.trains?.[0] || trainResult.best;

      const flightResult = await findFlightSegment(
         hub.geo,
         destination.geo,
         date
      );

      if (!flightResult?.found) continue;

      const totalFare =
        train.estimatedFare + flightResult.segment.minPrice;

      const totalDuration =
        train.durationMinutes +
        flightResult.segment.minDurationMinutes;

      const score =
        totalDuration * 0.6 +
        totalFare * 0.3 +
        hub.detourRatio * 200;

      candidates.push({
        hub: hub.city,
        train,
        flight: flightResult.segment,
        summary: { totalFare, totalDuration },
        score
      });
    }

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
      alternatives: candidates.slice(1, 2)
    };

  } catch (error) {
    logError(error, "findTrainFlightSegment");
    throw error;
  }
}



