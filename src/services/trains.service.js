import axios from "axios";
import { formatTrain } from "../utils/train.formatter.js";
import { config } from "./config.service.js";
import { logger } from "./logger.service.js";
import { findByCity, findByName } from "../utils/stationCodes.js";

const RAILWAY_BASE_URL = "https://api.railradar.in";
const headers = {
  "X-API-Key": config.railRadar.apiKey,
  Accept: "application/json",
};

// City to major railway station mapping
const CITY_STATION_MAP = {
  // Major Indian cities and their main railway stations
  delhi: { code: "NDLS", name: "New Delhi" },
  "new delhi": { code: "NDLS", name: "New Delhi" },
  mumbai: { code: "MMCT", name: "Mumbai Central" },
  pune: { code: "PUNE", name: "Pune" },
  bangalore: { code: "SBC", name: "Bangalore City" },
  bengaluru: { code: "SBC", name: "Bangalore City" },
  hyderabad: { code: "SC", name: "Secunderabad" },
  kolkata: { code: "KOAA", name: "Kolkata" },
  calcutta: { code: "KOAA", name: "Kolkata" },
  chennai: { code: "MAS", name: "Chennai Central" },
  madras: { code: "MAS", name: "Chennai Central" },
  indore: { code: "INDB", name: "Indore" },
  bhopal: { code: "BPL", name: "Bhopal" },
  goa: { code: "MAO", name: "Madgaon" },
  gurgaon: { code: "NDLS", name: "New Delhi" },
  noida: { code: "NDLS", name: "New Delhi" },
  jaipur: { code: "JP", name: "Jaipur" },
  lucknow: { code: "LKO", name: "Lucknow" },
  varanasi: { code: "MGS", name: "Mughal Sarai" },
  ahmedabad: { code: "ADI", name: "Ahmedabad" },
  surat: { code: "ST", name: "Surat" },
  vadodara: { code: "BRC", name: "Vadodara" },
  kanpur: { code: "CNB", name: "Kanpur Central" },
  patna: { code: "PNBE", name: "Patna" },
  agra: { code: "AG", name: "Agra" },
  mathura: { code: "MTJ", name: "Mathura" },
  guwahati: { code: "GHY", name: "Guwahati" },
  ranchi: { code: "RNC", name: "Ranchi" },
};

// Station priority for selection
function selectBestStation(stations) {
  if (!stations || !stations.length) {
    return null;
  }
  
  // Return first result (most relevant)
  return stations[0];
}

// Enhanced error logging function
function logApiError(error, operation) {
  logger.error(`Railway API Error in ${operation}:`, {
    status: error.response?.status,
    message: error.message,
    url: error.config?.url,
  });
}
// Find railway stations by text - returns best single station
// Uses city-to-station mapping for common cities
async function getStation(text) {
  try {
    if (!text) {
      throw new Error("City/station name is required");
    }
    const cityKey = text.toLowerCase().trim();

    // Prefer the stationCode.json data: try to find by city or station name
    const byCity = findByCity(text) || findByCity(cityKey);
    if (byCity) {
      logger.info(`Station lookup: ${text} -> ${byCity.stnCode} (${byCity.stnName}) [from stationCode.json]`);
      return { code: byCity.stnCode, name: byCity.stnName };
    }

    const byName = findByName(text) || findByName(cityKey);
    if (byName) {
      logger.info(`Station lookup: ${text} -> ${byName.stnCode} (${byName.stnName}) [from stationCode.json by name]`);
      return { code: byName.stnCode, name: byName.stnName };
    }

    // Fallback to the hard-coded mapping for cases not present in stationCode.json
    if (CITY_STATION_MAP[cityKey]) {
      const station = CITY_STATION_MAP[cityKey];
      logger.info(`Station lookup: ${text} -> ${station.code} (${station.name}) [from mapping]`);
      return station;
    }

    // If exact match not found, try partial match against the mapping
    for (const [city, station] of Object.entries(CITY_STATION_MAP)) {
      if (city.includes(cityKey) || cityKey.includes(city)) {
        logger.info(`Station lookup: ${text} -> ${station.code} (${station.name}) [partial match]`);
        return station;
      }
    }

    logger.warn(`Station mapping not found for: "${text}"`);
    throw new Error(`Station not found for city: "${text}". Please provide a valid Indian city name.`);
  } catch (err) {
    logger.error(`Railway station lookup failed for "${text}": ${err.message}`);
    throw new Error(`Failed to find station: ${err.message}`);
  }
}

// Fetch trains between two station codes using new RailRadar endpoint
async function getTrains(originCode, destinationCode) {
  if (!originCode || !destinationCode) {
    return [];
  }

  try {
    if (!config.railRadar.apiKey) {
      throw new Error("RailRadar API key is missing");
    }
    
    // New endpoint format: GET /v1/trains/between/{from}/{to}
    const url = `${RAILWAY_BASE_URL}/v1/trains/between/${originCode}/${destinationCode}`;
    logger.info(`Fetching trains from ${originCode} to ${destinationCode}`);
    logger.info(`Request URL: ${url}`);

    const response = await axios.get(url, {
      params: {
        live: false,
      },
      headers: {
        "Accept": "application/json",
        "X-API-Key": config.railRadar.apiKey,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Referer": "https://railradar.in/",
        "Origin": "https://railradar.in",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive",
      },
      timeout: 10000,
    });

    if (response.status !== 200) {
      throw new Error(`API returned status ${response.status}: ${response.statusText}`);
    }

    const trains = response.data?.data?.trains || [];
    logger.info(`Found ${trains.length} trains between ${originCode} and ${destinationCode}`);

    return trains
      .map((train) => {
        try {
          return formatTrain(train);
        } catch (err) {
          logger.warn(`Train formatting failed for train ${train?.number || 'unknown'}: ${err.message}`);
          return null;
        }
      })
      .filter(Boolean);
  } catch (err) {
    // 404 means no trains found, return empty array instead of throwing
    if (err.response?.status === 404) {
      logger.warn(`No trains found between ${originCode} and ${destinationCode}`);
      return [];
    }
    
    // For other errors, log and throw
    logApiError(err, "getTrains");
    logger.warn(`Train lookup failed for ${originCode}->${destinationCode}: ${err.message}`);
    throw new Error(`Failed to fetch trains: ${err.message}`);
  }
}

export { getStation, getTrains };
