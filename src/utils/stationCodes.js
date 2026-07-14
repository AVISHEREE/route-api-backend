import fs from "fs";
import path from "path";

let stationsMap = null;

function loadStationMap() {
  if (stationsMap) return;
  stationsMap = new Map();
  try {
    const p = path.join(process.cwd(), "src", "data", "stationCode.json");
    if (!fs.existsSync(p)) return;
    const raw = fs.readFileSync(p, "utf8");
    const data = JSON.parse(raw);
    if (Array.isArray(data.stations)) {
      data.stations.forEach((s) => {
        if (s && s.stnCode) stationsMap.set(s.stnCode, s);
      });
    }
  } catch (e) {
    stationsMap = new Map();
  }
}

function getStation(code) {
  if (!code) return null;
  loadStationMap();
  return stationsMap.get(code) || null;
}

function getName(code) {
  const s = getStation(code);
  return s ? s.stnName : null;
}

function getCity(code) {
  const s = getStation(code);
  return s ? s.stnCity : null;
}

function findByCity(city) {
  if (!city) return null;
  loadStationMap();
  const key = city.toLowerCase().trim();
  for (const s of stationsMap.values()) {
    if (s && s.stnCity && s.stnCity.toLowerCase().trim() === key) return s;
  }
  return null;
}

function findByName(name) {
  if (!name) return null;
  loadStationMap();
  const key = name.toLowerCase().trim();
  for (const s of stationsMap.values()) {
    if (s && s.stnName && s.stnName.toLowerCase().trim() === key) return s;
  }
  return null;
}

export { getStation, getName, getCity, findByCity, findByName };
