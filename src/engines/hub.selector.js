// src/engine/hub.selector.js
import { logger } from '../services/logger.service.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// This builds the path relative to the current file (hub.selector.js)
const hubDataPath = join(__dirname, '..', 'data', 'master_hubs.json');
const HUB_DATA = JSON.parse(readFileSync(hubDataPath, 'utf8'));
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function selectRailwayHubs(sourceGeo, destinationGeo) {
  const NEAR_RADIUS_KM = 60;
  const CONNECTIVITY_MAX_DIST = 700;
  const MID_RADIUS_KM = 350;
  const MAX_DETOUR_RATIO = 0.18; // ⭐ REAL FIX

  const directDistance = distanceKm(
    sourceGeo.lat,
    sourceGeo.lng,
    destinationGeo.lat,
    destinationGeo.lng
  );

  const midLat = (sourceGeo.lat + destinationGeo.lat) / 2;
  const midLng = (sourceGeo.lng + destinationGeo.lng) / 2;

  const hubs = HUB_DATA.railway_hubs.map(hub => {
    const distFromSource = distanceKm(
      sourceGeo.lat,
      sourceGeo.lng,
      hub.geo.lat,
      hub.geo.lng
    );

    const distToDestination = distanceKm(
      hub.geo.lat,
      hub.geo.lng,
      destinationGeo.lat,
      destinationGeo.lng
    );

    const distFromMid = distanceKm(
      midLat,
      midLng,
      hub.geo.lat,
      hub.geo.lng
    );

    const detour = distFromSource + distToDestination - directDistance;
    const detourRatio = detour / directDistance;

    return {
      ...hub,
      distFromSource,
      distFromMid,
      detour,
      detourRatio
    };
  });

  // 🅰️ NEAR HUBS
  const nearHubs = hubs
    .filter(hub =>
      hub.tier === 1 &&
      hub.distFromSource <= NEAR_RADIUS_KM &&
      (
        hub.type.toLowerCase().includes("suburban") ||
        hub.type.toLowerCase().includes("gateway") ||
        hub.type.toLowerCase().includes("national")
      )
    )
    .map(hub => ({
      ...hub,
      score:
        hub.distFromSource * 0.8 +
        (4 - hub.priority) * 25
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 2);

  // 🅱️ CONNECTIVITY HUBS (FINAL, CORRECT)
  const connectivityHubs = hubs
    .filter(hub =>
      hub.distFromSource > NEAR_RADIUS_KM &&
      hub.distFromSource <= CONNECTIVITY_MAX_DIST &&
      hub.distFromMid <= MID_RADIUS_KM &&
      hub.detourRatio <= MAX_DETOUR_RATIO &&   // ⭐ THIS KILLS BHOPAL
      hub.connectivity_score >= 7 &&
      hub.tier <= 2
    )
    .map(hub => ({
      ...hub,
      score:
        hub.detourRatio * 500 +
        hub.distFromMid * 0.25 +
        (10 - hub.connectivity_score) * 40 +
        (4 - hub.priority) * 20
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  return {
    nearHubs,
    connectivityHubs
  };
}

export function selectAirportHubs(sourceGeo, destinationGeo) {
  const NEAR_RADIUS_KM = 300;     // airports within 300 km
  const MAX_SOURCE_DIST = 800;    // don’t go too far back
  const MAX_HUBS = 5;

  const hubs = HUB_DATA.airport_hubs.map(hub => {
    const distFromSource = distanceKm(
      sourceGeo.lat,
      sourceGeo.lng,
      hub.geo.lat,
      hub.geo.lng
    );

    const distToDestination = distanceKm(
      hub.geo.lat,
      hub.geo.lng,
      destinationGeo.lat,
      destinationGeo.lng
    );

    return {
      ...hub,
      distFromSource,
      distToDestination
    };
  });

  // 🅰️ NEAR AIRPORT HUBS (PRIMARY)
  const nearHubs = hubs
    .filter(hub =>
      hub.distFromSource <= NEAR_RADIUS_KM &&
      hub.tier <= 2
    )
    .map(hub => ({
      ...hub,
      score:
        hub.distFromSource * 0.7 +
        (4 - hub.priority) * 40
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 2);

  // 🅱️ CONNECTIVITY AIRPORT HUBS
  const connectivityHubs = hubs
    .filter(hub =>
      hub.distFromSource > NEAR_RADIUS_KM &&
      hub.distFromSource <= MAX_SOURCE_DIST &&
      hub.tier <= 2
    )
    .map(hub => ({
      ...hub,
      score:
        hub.distFromSource * 0.4 +
        (4 - hub.priority) * 50 +
        hub.distToDestination * 0.2
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_HUBS);

  return {
    nearHubs,
    connectivityHubs
  };
}
