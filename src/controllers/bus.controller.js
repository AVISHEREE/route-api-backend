import { findDirectBuses } from "../engines/bus.engine.js";
import { saveSearch } from "../services/history.service.js";
import { isNonEmptyString, toNumber } from "../utils/validation.js";
import { logger } from "../services/logger.service.js";
export const getDirectBuses = async (req, res) => {
  try {
    const { origin, destination, limit } = req.query;
    if (!isNonEmptyString(origin) || !isNonEmptyString(destination)) {
      return res.status(400).json({
        success: false,
        message: "origin and destination are required",
      });
    }
    const parsedLimit = toNumber(limit) || 3;
    const result = await findDirectBuses(origin, destination, parsedLimit);
    void saveSearch(origin, destination, null);
    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error(`Bus Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
