import express from "express";
import { getFlightSegment } from "../controllers/flight.controller.js";

const router = express.Router();

router.post("/segment", getFlightSegment);

export default router;
