import { findFlightSegment } from "../engines/flight.engine.js";
import { saveSearch } from "../services/history.service.js";
import { isValidDateString, toNumber } from "../utils/validation.js";
import { logger } from "../services/logger.service.js";
export const getFlightSegment = async (req, res) => {
  try {
    const { sourceLat, sourceLng, destLat, destLng, date } = req.body;
    const sLat = toNumber(sourceLat);
    const sLng = toNumber(sourceLng);
    const dLat = toNumber(destLat);
    const dLng = toNumber(destLng);
    if (sLat === null || sLng === null || dLat === null || dLng === null) {
      return res.status(400).json({
        success: false,
        message: "sourceLat/sourceLng/destLat/destLng must be numbers",
      });
    }
    if (!isValidDateString(date)) {
      return res.status(400).json({
        success: false,
        message: "date must be a valid date string",
      });
    }

    const result = await findFlightSegment(
      { lat: sLat, lng: sLng },
      { lat: dLat, lng: dLng },
      date);
    void saveSearch(`${sLat},${sLng}`, `${dLat},${dLng}`, date);
    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error(`Flight Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
