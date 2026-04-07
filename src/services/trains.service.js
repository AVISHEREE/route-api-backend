import axios from "axios";
import { formatTrain } from "../utils/train.formatter.js";
import { config } from "./config.service.js";
import { logger } from "./logger.service.js";

const RAILWAY_URL_V1 = "https://api.railradar.in/api/v1";
const headers = {
  "X-API-Key": config.railRadar.apiKey,
  Accept: "application/json",
};
axios.interceptors.request.use((req) => {
  console.log("=== OUTGOING REQUEST ===");
  console.log("URL:", req.url);
  console.log("Params:", JSON.stringify(req.params));
  console.log("Headers:", JSON.stringify(req.headers));
  console.log("========================");
  return req;
});

// Enhanced error logging function
function logApiError(error, operation) {
  console.log(`❌ API ERROR in ${operation}:`);
  console.log("Status:", error.response?.status);
  console.log("Status Text:", error.response?.statusText);
  console.log("Headers:", error.response?.headers);
  console.log("Data:", error.response?.data);
  console.log("Message:", error.message);
  console.log("Config:", {
    url: error.config?.url,
    method: error.config?.method,
    params: error.config?.params,
  });

  logger.error(`Railway API Error in ${operation}:`, {
    status: error.response?.status,
    statusText: error.response?.statusText,
    data: error.response?.data,
    message: error.message,
    url: error.config?.url,
    params: error.config?.params,
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
console.log("ENV CHECK:");
console.log("API KEY:", config.railRadar.apiKey ? "Present ✅" : "Missing ❌");
console.log("BASE URL:", RAILWAY_URL_V1); 
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
      headers,
    });

    if (response.status !== 200) {
      throw new Error(`API returned status ${response.status}: ${response.statusText}`);
    }

    const trains = response.data?.data?.trains || [];

    console.log(`Found ${trains.length} trains from API`);

    return trains
      .map((train) => {
        try {
          return formatTrain(train);
        } catch (err) {
          console.log(`Error formatting train ${train?.number || 'unknown'}:`, err.message);
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
