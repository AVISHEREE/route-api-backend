import express from "express";
import {
  getDirectTrains,
  getIndirectTrains,
  processDirectTrainsController,
} from "../controllers/train.controller.js";

const router = express.Router();

router.get("/direct", getDirectTrains);
router.post("/indirect", getIndirectTrains);
router.post("/process", processDirectTrainsController);

export default router;
