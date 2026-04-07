import {
  findDirectTrains,
  findTwoIndirectTrainSegments,
} from "../engines/train.engine.js";
import { saveSearch } from "../services/history.service.js";
import {
  isNonEmptyString,
  isObject,
  isValidDateString,
  toNumber,
} from "../utils/validation.js";
import { logger } from "../services/logger.service.js";

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
    console.log("❌ AXIOS ERROR:");
    console.log("Status:", error.response?.status);
    console.log("Headers:", error.response?.headers);
    console.log("Data:", error.response?.data);
    console.log("Message:", error.message);
    console.log("Stack:", error.stack);

    // Provide detailed error information
    const errorDetails = {
      success: false,
      message: error.message,
      type: error.name || 'UnknownError',
      details: {
        apiStatus: error.response?.status,
        apiStatusText: error.response?.statusText,
        apiData: error.response?.data,
        url: error.config?.url,
        params: error.config?.params,
      }
    };

    res.status(error.response?.status || 500).json(errorDetails);
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
    console.log("❌ INDIRECT TRAIN ERROR:");
    console.log("Message:", error.message);
    console.log("Stack:", error.stack);

    // Provide detailed error information
    const errorDetails = {
      success: false,
      message: error.message,
      type: error.name || 'UnknownError',
      details: error.response ? {
        apiStatus: error.response.status,
        apiStatusText: error.response.statusText,
        apiData: error.response.data,
        url: error.config?.url,
        params: error.config?.params,
      } : null
    };

    res.status(error.response?.status || 500).json(errorDetails);
  }
};
