import axios from "axios";
import { formatTrain } from "../utils/train.formatter.js";
import { config } from "./config.service.js";
import { logger } from "./logger.service.js";

const RAILWAY_URL_V1 = "https://api.railradar.in/api/v1";
const headers = {
  "X-API-Key": config.railRadar.apiKey,
  Accept: "application/json",
};

// Enhanced error logging function
function logApiError(error, operation) {
  logger.error(`Railway API Error in ${operation}:`, {
    status: error.response?.status,
    message: error.message,
    url: error.config?.url,
  });
}
// Find railway stations by text
async function getStation(
  text,
  ignoreKeywords = ["shed", "loco", "cabin", "outer", "yard", "depot"],
  maxResults = 10,
) {
  try {
    if (!config.railRadar.apiKey) {
      throw new Error("RailRadar API key is missing");
    }
    const url = `${RAILWAY_URL_V1}/search/stations`;

    const response = await axios.get(url, {
      params: {
        query: text,
      },
      headers,
    });

    if (response.status !== 200) {
      throw new Error(`API returned status ${response.status}: ${response.statusText}`);
    }

    const results = response.data?.data?.stations || [];

    return results
      .map((station) => ({
        name: station.name || "",
        code: station.code || "",
        state: station.state || "",
      }))
      .filter((station) => {
        if (
          ignoreKeywords.some((word) =>
            station.name.toLowerCase().includes(word.toLowerCase()),
          )
        ) {
          return false;
        }
        return true;
      })
      .slice(0, maxResults);
  } catch (err) {
    logApiError(err, "getStation");
    logger.warn(`Railway station lookup failed: ${err.message}`);
    throw new Error(`Failed to search stations: ${err.message}`);
  }
}

async function getTrains(origin, destination) {
  if (!origin || !destination) {
    return [];
  }

  try {
    if (!config.railRadar.apiKey) {
      throw new Error("RailRadar API key is missing");
    }
    const url = `${RAILWAY_URL_V1}/trains/between`;
    console.log(`Fetching trains from ${origin} to ${destination}`);
    console.log(`Request URL: ${url}`);

    const response = await axios.get(url, {
      params: {
        from: origin,
        to: destination,
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
    });

    if (response.status !== 200) {
      throw new Error(`API returned status ${response.status}: ${response.statusText}`);
    }

    const trains = response.data?.data?.trains || [];

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
    logApiError(err, "getTrains");
    logger.warn(`Train lookup failed: ${err.message}`);
    throw new Error(`Failed to fetch trains: ${err.message}`);
  }
}

export { getStation, getTrains };
