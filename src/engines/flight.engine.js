import { searchFlights } from "../services/flights.service.js";
import { selectAirportHubs } from "./hub.selector.js";

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
export async function findFlightSegment({
  sourceGeo,
  destinationGeo,
  outboundDate
}) {
  // 1️⃣ Source hub
  const sourceHubResult = selectAirportHubs(sourceGeo, destinationGeo);
  const sourcePick = pickBestHub(sourceHubResult);

  if (!sourcePick) {
    return { found: false, reason: "NO_SOURCE_HUB" };
  }

  // 2️⃣ Destination hub
  const destHubResult = selectAirportHubs(destinationGeo, sourceGeo);
  const destPick = pickBestHub(destHubResult);

  if (!destPick) {
    return { found: false, reason: "NO_DEST_HUB" };
  }

  // 3️⃣ Check flights
  const flights = await searchFlights({
    source: sourcePick.hub.code,
    destination: destPick.hub.code,
    outboundDate,
    type: 2,
    sort: "best"
  });

  if (!flights || flights.length === 0) {
    return { found: false, reason: "NO_FLIGHT_SEGMENT" };
  }

  const prices = flights.map(f => f.price).filter(Boolean);
  const durations = flights.map(f => f.durationMinutes).filter(Boolean);

  // 4️⃣ Segment response (FULL ADDRESS)
  return {
    found: true,
    type: "FLIGHT_SEGMENT",

    segment: {
      from: {
        airportCode: sourcePick.hub.code,
        airportName: sourcePick.hub.name,
        address: buildAirportAddress(sourcePick.hub),
        city: sourcePick.hub.city,
        state: sourcePick.hub.state
      },

      to: {
        airportCode: destPick.hub.code,
        airportName: destPick.hub.name,
        address: buildAirportAddress(destPick.hub),
        city: destPick.hub.city,
        state: destPick.hub.state
      },

      sourceHubType: sourcePick.type,
      destinationHubType: destPick.type,

      flightCount: flights.length,
      minPrice: Math.min(...prices),
      minDurationMinutes: Math.min(...durations)
    },

    reason: "FLIGHT_SEGMENT_AVAILABLE"
  };
}
const test = async () => {
  const res = await findFlightSegment({
    sourceGeo: { lat: 19.2813, lng: 73.0483 }, // Bhiwandi
    destinationGeo: { lat: 9.9816, lng:76.2999 }, // Ernakulam
    outboundDate: "2026-01-22"
  });

  console.log(JSON.stringify(res, null, 2));
};

test();
