import axios from "axios";
import { config } from "./config.service.js";

const GOOGLE_MAPS_BASE_URL = "https://maps.googleapis.com/maps/api";
const GOOGLE_PLACES_V1_URL = "https://places.googleapis.com/v1/places:searchNearby";
// const API_KEY = config.google.apiKey ;
const API_KEY = config.google.apiKey ;

// 1️⃣ Convert city name → lat/lng
async function getCoordinates(city) {
  const url = `${GOOGLE_MAPS_BASE_URL}/geocode/json`;

  const response = await axios.get(url, {
    params: {
      address: city,
      key: API_KEY,
    },
  });

  if (!response.data.results.length) {
    throw new Error("Invalid city name");
  }

  const location = response.data.results[0].geometry.location;

  return {
    lat: location.lat,
    lng: location.lng,
  };
}

// 2️⃣ Search nearby places (stations, airports, bus stops)
async function searchNearby(
  lat,
  lng,
  includedTypes,
  radius = 10000,
  maxResults = 5,
  ignoreTypes = [],
  ignoreKeywords = []
) {
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
    }
  );

  // 🔒 DEFENSIVE CHECK (THIS FIXES YOUR ERROR)
  const places = response.data.places || [];

  return places
    .map(place => ({
      name: place.displayName?.text || "",
      lat: place.location?.latitude,
      lng: place.location?.longitude,
      types: place.types || [],
    }))
    .filter(place => {
      // ignore unwanted Google place types
      if (
        ignoreTypes.length &&
        place.types.some(type => ignoreTypes.includes(type))
      ) {
        return false;
      }

      // ignore unwanted keywords in name
      if (
        ignoreKeywords.length &&
        ignoreKeywords.some(word =>
          place.name.toLowerCase().includes(word.toLowerCase())
        )
      ) {
        return false;
      }

      return true;
    });
}


// 3️⃣ Distance & travel time
async function getDistanceAndTime(origin, destination) {
  const url = `${GOOGLE_MAPS_BASE_URL}/distancematrix/json`;

  const response = await axios.get(url, {
    params: {
      origins: origin,
      destinations: destination,
      key: API_KEY,
    },
  });

  const element = response.data.rows[0].elements[0];

  return {
    distanceText: element.distance.text,
    distanceValue: element.distance.value,
    durationText: element.duration.text,
    durationValue: element.duration.value,
  };
}

export {
  getCoordinates,
  searchNearby,
  getDistanceAndTime,
}

/**
 * Refined logic to specifically target Junctions.
 * I have added a 'junctionOnly' logic to your search.
 */
// async function abc() {
//   const city = "Bhiwandi"; 
//   const coords = await getCoordinates(city);

//   // Search for train stations within 20km
//   const allStations = await searchNearby(
//     coords.lat,
//     coords.lng,
//     ["train_station"], 
//     20000, 
//     10 
//   );

//   // 1. Try to find strict Junctions first
//   let targetStations = allStations.filter(place => 
//     place.name.toLowerCase().includes("junction") || 
//     place.name.toLowerCase().includes("jn")
//   );

//   // 2. SMART FALLBACK: If no "Junction" exists, take the closest main station
//   if (targetStations.length === 0 && allStations.length > 0) {
//     console.log("No technical Junction found. Picking main station...");
//     targetStations = [allStations[0]]; // Pick the most relevant one
//   }

//   console.log(`--- Connectivity Hubs near ${city} ---`);
//   console.log(targetStations);
// }
// async function abc() {
//   const abc = await getDistanceAndTime("Bhiwandi","Kalyan")
//   console.log(abc)
// }

// abc();
