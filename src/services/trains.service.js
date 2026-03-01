import axios from "axios";
import { formatTrain } from "../utils/train.formatter.js";
import { config } from "./config.service.js";
import { logger } from "./logger.service.js";

const RAILWAY_URL_V1 = "https://api.railradar.in/api/v1";
const headers = {
  "X-API-Key": config.railRadar.apiKey,
  Accept: "application/json",
};

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
    logger.warn(`Railway station lookup failed: ${err.message}`);
    throw new Error("Failed to search stations");
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

    const response = await axios.get(url, {
      params: {
        from: origin,
        to: destination,
      },
      headers,
    });

    const trains = response.data?.data?.trains || [];

    return trains
      .map((train) => {
        try {
          return formatTrain(train);
        } catch (err) {
          return null;
        }
      })
      .filter(Boolean);
  } catch (err) {
    logger.warn(`Train lookup failed: ${err.message}`);
    throw new Error("Failed to fetch trains");
  }
}

export { getStation, getTrains };
