// src/engine/hub.selector.js

import fs from "fs";
import path from "path";

const HUBS_PATH = path.resolve("./src/data/master_hubs.json");
const HUB_DATA = JSON.parse(fs.readFileSync(HUBS_PATH, "utf-8"));

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

/* ============================================================
   RAILWAY HUB SELECTOR
============================================================ */

export function selectRailwayHubs(sourceGeo, destinationGeo, mode = "train") {
  const NEAR_RADIUS_KM = 60;
  const CONNECTIVITY_MAX_DIST = 700;
  const MID_RADIUS_KM = 350;
  const MAX_DETOUR_RATIO = 0.18;

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
      distToDestination,
      distFromMid,
      detourRatio
    };
  });

  // 🅰️ NEAR HUBS (Train mode only)
  const nearHubs =
    mode === "train"
      ? hubs
          .filter(
            hub =>
              hub.tier === 1 &&
              hub.distFromSource <= NEAR_RADIUS_KM
          )
          .sort((a, b) => a.distFromSource - b.distFromSource)
          .slice(0, 2)
      : [];

  // 🅱️ CONNECTIVITY HUBS
  const connectivityHubs = hubs
    .filter(hub => {
      if (mode === "train") {
        return (
          hub.distFromSource > NEAR_RADIUS_KM &&
          hub.distFromSource <= CONNECTIVITY_MAX_DIST &&
          hub.distFromMid <= MID_RADIUS_KM &&
          hub.detourRatio <= MAX_DETOUR_RATIO &&
          hub.connectivity_score >= 7 &&
          hub.tier <= 2
        );
      }

      if (mode === "flight-train") {
        // ⭐ KEY FIX: Destination-based filtering
        return (
          hub.distToDestination <= 250 &&
          hub.tier <= 2
        );
      }

      return false;
    })
    .sort((a, b) => {
      if (mode === "flight-train") {
        return a.distToDestination - b.distToDestination;
      }
      return a.detourRatio - b.detourRatio;
    })
    .slice(0, 3);

  return {
    nearHubs,
    connectivityHubs
  };
}

/* ============================================================
   AIRPORT HUB SELECTOR
============================================================ */

export function selectAirportHubs(sourceGeo, destinationGeo, mode = "flight") {
  const NEAR_RADIUS_KM = 300;
  const MAX_SOURCE_DIST = 800;
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

  // 🅰️ NEAR HUBS
  const nearHubs = hubs
    .filter(hub => {
      if (mode === "flight") {
        return hub.distFromSource <= NEAR_RADIUS_KM;
      }

      if (mode === "flight-train") {
        // ⭐ KEY FIX: Destination-based airport selection
        return hub.distToDestination <= 300;
      }

      return false;
    })
    .sort((a, b) => {
      if (mode === "flight-train") {
        return a.distToDestination - b.distToDestination;
      }
      return a.distFromSource - b.distFromSource;
    })
    .slice(0, 2);

  // 🅱️ CONNECTIVITY HUBS
  const connectivityHubs =
    mode === "flight"
      ? hubs
          .filter(
            hub =>
              hub.distFromSource > NEAR_RADIUS_KM &&
              hub.distFromSource <= MAX_SOURCE_DIST
          )
          .sort((a, b) => a.distFromSource - b.distFromSource)
          .slice(0, MAX_HUBS)
      : [];

  return {
    nearHubs,
    connectivityHubs
  };
}

export const HUB_DATA_ex = {
  railway_hubs: HUB_DATA.railway_hubs || [],
  airport_hubs: HUB_DATA.airport_hubs || []
};