import { calculateDistance } from "./distance.util.js";

export function sortByDistance(originLat, originLng, places) {
  return (places || [])
    .map((place) => ({
      ...place,
      distanceKm: calculateDistance(
        originLat,
        originLng,
        place.lat,
        place.lng,
      ),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
