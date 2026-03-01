import express from "express";
import {
  getDirectTrains,
  getIndirectTrains
} from "../controllers/train.controller.js";

const router = express.Router();

router.get("/direct", getDirectTrains);
router.post("/indirect", getIndirectTrains);

export default router;
