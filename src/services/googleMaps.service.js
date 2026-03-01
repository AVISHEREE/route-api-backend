import axios from "axios";
import { config } from "./config.service.js";
import { logger } from "./logger.service.js";

const GOOGLE_MAPS_BASE_URL = "https://maps.googleapis.com/maps/api";
const GOOGLE_PLACES_V1_URL = "https://places.googleapis.com/v1/places:searchNearby";
const API_KEY = config.google.apiKey;

// 1️⃣ Convert city name → lat/lng
async function getCoordinates(city) {
  try {
    if (!API_KEY) throw new Error("Google Maps API key is missing");
    const url = `${GOOGLE_MAPS_BASE_URL}/geocode/json`;

    const response = await axios.get(url, {
      params: {
        address: city,
        key: API_KEY,
      },
    });

    if (!response.data?.results?.length) {
      throw new Error("Invalid city name");
    }

    const location = response.data.results[0].geometry.location;

    return {
      lat: location.lat,
      lng: location.lng,
    };
  } catch (err) {
    logger.warn(`Geocode failed: ${err.message}`);
    throw new Error("Failed to resolve coordinates");
  }
}

// 2️⃣ Search nearby places (stations, airports, bus stops)
async function searchNearby(
  lat,
  lng,
  includedTypes,
  radius = 10000,
  maxResults = 5,
  ignoreTypes = [],
  ignoreKeywords = [],
) {
  try {
    if (!API_KEY) throw new Error("Google Maps API key is missing");
    const response = await axios.post(
      GOOGLE_PLACES_V1_URL,
      {
        includedTypes: Array.isArray(includedTypes)
          ? includedTypes
          : [includedTypes],
        maxResultCount: maxResults,
        locationRestriction: {
          circle: {
            center: {
              latitude: lat,
              longitude: lng,
            },
            radius,
          },
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": API_KEY,
          "X-Goog-FieldMask":
            "places.displayName,places.location,places.types",
        },
      },
    );

    const places = response.data?.places || [];

    return places
      .map((place) => ({
        name: place.displayName?.text || "",
        lat: place.location?.latitude,
        lng: place.location?.longitude,
        types: place.types || [],
      }))
      .filter((place) => {
        if (
          ignoreTypes.length &&
          place.types.some((type) => ignoreTypes.includes(type))
        ) {
          return false;
        }

        if (
          ignoreKeywords.length &&
          ignoreKeywords.some((word) =>
            place.name.toLowerCase().includes(word.toLowerCase()),
          )
        ) {
          return false;
        }

        return true;
      });
  } catch (err) {
    logger.warn(`Places search failed: ${err.message}`);
    throw new Error("Failed to search nearby places");
  }
}

// 3️⃣ Distance & travel time
async function getDistanceAndTime(origin, destination) {
  try {
    if (!API_KEY) throw new Error("Google Maps API key is missing");
    const url = `${GOOGLE_MAPS_BASE_URL}/distancematrix/json`;

    const response = await axios.get(url, {
      params: {
        origins: origin,
        destinations: destination,
        key: API_KEY,
      },
    });

    const element = response.data?.rows?.[0]?.elements?.[0];
    if (!element?.distance || !element?.duration) {
      throw new Error("Invalid distance matrix response");
    }

    return {
      distanceText: element.distance.text,
      distanceValue: element.distance.value,
      durationText: element.duration.text,
      durationValue: element.duration.value,
    };
  } catch (err) {
    logger.warn(`Distance lookup failed: ${err.message}`);
    throw new Error("Failed to fetch distance");
  }
}

export { getCoordinates, searchNearby, getDistanceAndTime };
