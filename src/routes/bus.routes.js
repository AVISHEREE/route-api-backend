import express from "express";
import { getDirectBuses } from "../controllers/bus.controller.js";

const router = express.Router();

router.get("/direct", getDirectBuses);

export default router;
