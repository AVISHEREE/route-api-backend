import axios from "axios";
import {formatTrain} from '../utils/train.formatter.js'
import { config } from "./config.service.js";
const RAILWAY_URL_V1 = "https://api.railradar.in/api/v1";
const headers = {
  "X-API-Key": config.railRadar.apiKey,
  Accept: "application/json",
};
// Find railway stations by text
async function  getStation(
  text,
  ignoreKeywords = ["shed", "loco", "cabin", "outer", "yard", "depot"],
  maxResults = 10
) {
  const url = `${RAILWAY_URL_V1}/search/stations`;

  const response = await axios.get(url, {
    params: {
      query: text,
    },
    headers
  });
  const results = response.data.data?.stations || [];

  return results
    .map((station) => ({
      name: station.name || "",
      code: station.code || "",
      state: station.state || "",
    }))
    .filter((station) => {
      if (
        ignoreKeywords.some((word) =>
          station.name.toLowerCase().includes(word.toLowerCase())
        )
      ) {
        return false;
      }
      return true;
    })
    .slice(0, maxResults);
}

async function getTrains(origin, destination) {
  
  if (!origin || !destination) {
    return [];
  }

  const url = `${RAILWAY_URL_V1}/trains/between`;

  const response = await axios.get(url, {
    params: {
      from: origin,
      to: destination,
    },
    headers
  });

  // ✅ Correct defensive parsing
  const trains = response.data?.data?.trains || [];

  return trains.map(formatTrain);
}

export {
  getStation,
  getTrains
}

// const abc = async () => {
//   const stations = await getStation("Bhiwandi");

//   if (!stations.length) {
//     console.log("No stations found");
//     return;
//   }

//   console.log(stations);
//   console.log("Using station:", stations[0].name);

//   // 👇 YOU MUST PASS DESTINATION
//   const trains = await getTrains(stations[0].code, "JP"); // Jaipur example

//   console.log(trains);
// };

// abc();
