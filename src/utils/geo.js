/**
 * Calculate distance between two geo points (km)
 * Uses Haversine formula
 */
export function distanceKm(lat1, lng1, lat2, lng2) {
  if (
    lat1 == null || lng1 == null ||
    lat2 == null || lng2 == null
  ) {
    throw new Error(
      `distanceKm: Invalid coordinates (${lat1}, ${lng1}) → (${lat2}, ${lng2})`
    );
  }

  const toRad = (deg) => (deg * Math.PI) / 180;

  const R = 6371; // Earth radius in KM
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

