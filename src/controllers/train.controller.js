import {
  findDirectTrains,
  findTwoIndirectTrainSegments,
  processDirectTrains,
} from "../engines/train.engine.js";
import { saveSearch } from "../services/history.service.js";
import {
  isNonEmptyString,
  isObject,
  isValidDateString,
  isArray,
  toNumber,
} from "../utils/validation.js";
import { logger } from "../services/logger.service.js";
import { formatTrain } from "../utils/train.formatter.js";

export const getDirectTrains = async (req, res) => {
  try {
    const { source, destination, date } = req.query;
    if (!isNonEmptyString(source) || !isNonEmptyString(destination)) {
      return res.status(400).json({
        success: false,
        message: "source and destination are required",
      });
    }
    if (!isValidDateString(date)) {
      return res.status(400).json({
        success: false,
        message: "date must be a valid date string",
      });
    }

    const result = await findDirectTrains(source, destination, date);
    void saveSearch(source, destination, date);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error(`Train Error: ${error.message}`);
    res.status(error.response?.status || 500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getIndirectTrains = async (req, res) => {
  try {
    const { source, destination, date } = req.body;
    if (!isObject(source) || !isObject(destination)) {
      return res.status(400).json({
        success: false,
        message: "source and destination objects are required",
      });
    }
    if (!isNonEmptyString(source.code) || !isNonEmptyString(destination.code)) {
      return res.status(400).json({
        success: false,
        message: "source.code and destination.code are required",
      });
    }
    if (!isObject(source.geo) || !isObject(destination.geo)) {
      return res.status(400).json({
        success: false,
        message: "source.geo and destination.geo are required",
      });
    }
    const sourceLat = toNumber(source.geo.lat);
    const sourceLng = toNumber(source.geo.lng);
    const destLat = toNumber(destination.geo.lat);
    const destLng = toNumber(destination.geo.lng);
    if (
      sourceLat === null ||
      sourceLng === null ||
      destLat === null ||
      destLng === null
    ) {
      return res.status(400).json({
        success: false,
        message: "source.geo and destination.geo must contain numeric lat/lng",
      });
    }
    if (!isValidDateString(date)) {
      return res.status(400).json({
        success: false,
        message: "date must be a valid date string",
      });
    }
    source.geo.lat = sourceLat;
    source.geo.lng = sourceLng;
    destination.geo.lat = destLat;
    destination.geo.lng = destLng;
    const result = await findTwoIndirectTrainSegments(
      source,
      destination,
      date,
    );
    void saveSearch(source.code, destination.code, date);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error(`Indirect Train Error: ${error.message}`);
    res.status(error.response?.status || 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Process frontend-provided train data without calling external APIs
 * Accepts raw train data from frontend and applies business logic
 *
 * Request body:
 * {
 *   "source": "BIRD",
 *   "destination": "FA",
 *   "date": "2026-04-24",
 *   "trains": [...] // raw trains data from frontend
 * }
 */
export const processDirectTrainsController = async (req, res) => {
  try {
    const { source, destination, date, trains } = req.body;

    // Validate required fields
    if (!isNonEmptyString(source) || !isNonEmptyString(destination)) {
      return res.status(400).json({
        success: false,
        message: "source and destination are required",
      });
    }

    if (!isValidDateString(date)) {
      return res.status(400).json({
        success: false,
        message: "date must be a valid date string",
      });
    }

    if (!isArray(trains) || trains.length === 0) {
      return res.status(400).json({
        success: false,
        message: "trains must be a non-empty array",
      });
    }

    // Format raw RailRadar trains into the internal schema expected by the engine.
    // The browser sends raw API objects (field names: travelTimeMinutes, runningDays.days, etc.).
    // formatTrain() translates them to: durationMinutes, runningDays[], estimatedFare, etc.
    const formattedTrains = trains
      .map((raw) => {
        try {
          return formatTrain(raw);
        } catch (err) {
          logger.warn(`Skipping malformed train object: ${err.message}`);
          return null;
        }
      })
      .filter(Boolean);

    if (formattedTrains.length === 0) {
      return res.status(422).json({
        success: false,
        message: "No valid trains could be extracted from the provided data",
      });
    }

    // Apply business logic: date filtering, scoring, analytics, caching
    const result = await processDirectTrains(source, destination, date, formattedTrains);

    // Record in search history
    void saveSearch(source, destination, date);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error(`Process Train Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
