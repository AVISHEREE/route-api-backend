import { findTrainFlightSegment , findFlightTrainSegment , findBusFlightSegment , findTrainBusSegment } from "../engines/segment.engine.js";
import { saveSearch } from "../services/history.service.js";
import {
  isNonEmptyString,
  isObject,
  isValidDateString,
  toNumber,
} from "../utils/validation.js";
import { logger } from "../services/logger.service.js";

function validateLocation(obj, name) {
  if (!isObject(obj)) return `${name} is required`;
  if (!isNonEmptyString(obj.code)) return `${name}.code is required`;
  if (!isNonEmptyString(obj.city)) return `${name}.city is required`;
  if (!isObject(obj.geo)) return `${name}.geo is required`;
  const lat = toNumber(obj.geo.lat);
  const lng = toNumber(obj.geo.lng);
  if (lat === null || lng === null) {
    return `${name}.geo.lat and ${name}.geo.lng must be numbers`;
  }
  obj.geo.lat = lat;
  obj.geo.lng = lng;
  return null;
}
export const getTrainFlightSegment = async (req, res) => {
  try {
    const { source, destination, date } = req.body;
    const sourceError = validateLocation(source, "source");
    if (sourceError) {
      return res.status(400).json({ success: false, message: sourceError });
    }
    const destError = validateLocation(destination, "destination");
    if (destError) {
      return res.status(400).json({ success: false, message: destError });
    }
    if (!isValidDateString(date)) {
      return res
        .status(400)
        .json({ success: false, message: "date must be a valid date string" });
    }

    const result = await findTrainFlightSegment(source, destination, date);
    void saveSearch(source.code, destination.code, date);
    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error(`Segment Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
export const getFlightTrainSegment = async (req, res) => {
  try {
    const { source, destination, date } = req.body;
    const sourceError = validateLocation(source, "source");
    if (sourceError) {
      return res.status(400).json({ success: false, message: sourceError });
    }
    const destError = validateLocation(destination, "destination");
    if (destError) {
      return res.status(400).json({ success: false, message: destError });
    }
    if (!isValidDateString(date)) {
      return res
        .status(400)
        .json({ success: false, message: "date must be a valid date string" });
    }

    const result = await findFlightTrainSegment(source, destination, date);
    void saveSearch(source.code, destination.code, date);
    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error(`Segment Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getBusFlightSegment = async (req, res) => {
  try {
    const { source, destination, date } = req.body;
    const sourceError = validateLocation(source, "source");
    if (sourceError) {
      return res.status(400).json({ success: false, message: sourceError });
    }
    const destError = validateLocation(destination, "destination");
    if (destError) {
      return res.status(400).json({ success: false, message: destError });
    }
    if (!isValidDateString(date)) {
      return res
        .status(400)
        .json({ success: false, message: "date must be a valid date string" });
    }

    const result = await findBusFlightSegment(source, destination, date);
    void saveSearch(source.code, destination.code, date);
    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error(`Segment Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
export const getTrainBusSegment = async (req, res) => {
  try {
    const { source, destination, date } = req.body;
    const sourceError = validateLocation(source, "source");
    if (sourceError) {
      return res.status(400).json({ success: false, message: sourceError });
    }
    const destError = validateLocation(destination, "destination");
    if (destError) {
      return res.status(400).json({ success: false, message: destError });
    }
    if (!isValidDateString(date)) {
      return res
        .status(400)
        .json({ success: false, message: "date must be a valid date string" });
    }

    const result = await findTrainBusSegment(source, destination, date);
    void saveSearch(source.code, destination.code, date);
    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error(`Segment Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
