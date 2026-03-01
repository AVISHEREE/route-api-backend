import RouteResult from "../models/RouteResult.model.js";
import { logger } from "./logger.service.js";

export async function recordRouteResult(payload) {
  if (!payload) return;
  try {
    await RouteResult.create(payload);
  } catch (err) {
    logger.warn(`Analytics write failed: ${err.message}`);
  }
}
