import express from "express";
import { getTrainFlightSegment , getFlightTrainSegment , getBusFlightSegment , getTrainBusSegment } from "../controllers/segment.controller.js";

const router = express.Router();

router.post("/train-flight", getTrainFlightSegment);
router.post("/flight-train", getFlightTrainSegment);
router.post("/bus-flight", getBusFlightSegment);
router.post("/train-bus", getTrainBusSegment);
export default router;
