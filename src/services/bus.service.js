import axios from "axios";
import { config } from "./config.service.js";
import { logger } from "./logger.service.js";

const GOOGLE_MAPS_BASE_URL =
  "https://maps.googleapis.com/maps/api/directions/json";

const apiKey = config.google.apiKey ;
/**
 * Estimate bus fare (Google does NOT give fare in India)
 * Average local bus fare ≈ ₹2 per km
 */
function estimateFare(distanceText) {
  if (!distanceText) return null;

  const km = parseFloat(distanceText.replace(" km", ""));
  if (isNaN(km)) return null;

  return Math.round(km * 2); // ₹
}

/**
 * Filter ONLY useful bus-related data
 */
function filterBusRoutes(data) {
  if (!data.routes || data.routes.length === 0) {
    return [];
  }

  const finalRoutes = [];

  data.routes.forEach((route, routeIndex) => {
    const leg = route.legs[0];
    const buses = [];
    const busMap = new Map(); // dedupe inside ONE route

    for (const step of leg.steps) {
      if (
        step.travel_mode === "TRANSIT" &&
        step.transit_details &&
        step.transit_details.line &&
        step.transit_details.line.vehicle.type === "BUS"
      ) {
        const bus = {
          busName: step.transit_details.line.name || "Unknown",
          busNumber: step.transit_details.line.short_name || null,
          fromStop: step.transit_details.departure_stop.name,
          toStop: step.transit_details.arrival_stop.name,
          departureTime: step.transit_details.departure_time.text,
          arrivalTime: step.transit_details.arrival_time.text,
          duration: step.duration.text,
          distance: step.distance.text,
          estimatedFare: estimateFare(step.distance.text),
        };

        const key = `${bus.busName}-${bus.fromStop}-${bus.toStop}-${bus.departureTime}`;

        if (!busMap.has(key)) {
          busMap.set(key, bus);
          buses.push(bus);
        }
      }
    }

    // Only include routes that actually have buses
    if (buses.length > 0) {
      finalRoutes.push({
        routeId: routeIndex + 1,
        totalDistance: leg.distance.text,
        totalDuration: leg.duration.text,
        buses,
      });
    }
  });

  return finalRoutes;
}

function smartRouteFilter(routes) {
  if (routes.some(r => r.buses.length === 1)) {
    return routes.filter(r => r.buses.length === 1);
  }

  const minChanges = Math.min(...routes.map(r => r.buses.length));
  return routes.filter(r => r.buses.length === minChanges);
}


/**
 * MAIN SERVICE FUNCTION
 * Used by controller
 */
export async function getBusRoutesService(origin, destination) {
  try {
    if (!config.google.apiKey) {
      throw new Error("Google Maps API key is missing");
    }
    const response = await axios.get(GOOGLE_MAPS_BASE_URL, {
      params: {
        origin,
        destination,
        mode: "transit",
        transit_mode: "bus",
        
        alternatives: true,
        key: apiKey,
      },
    });

    const groupedRoutes = filterBusRoutes(response.data);
    const optimizedRoutes = smartRouteFilter(groupedRoutes);
    return optimizedRoutes;
  } catch (error) {
    logger.warn(`Bus service error: ${error.message}`);
    throw new Error("Failed to fetch bus routes");
  }
}


// const abc = async () => {
//   const abc = await getBusRoutesService("Kalyan,Maharashtra", "Bhiwandi");
//   console.log(JSON.stringify(abc, null, 2));
// };
// abc();
