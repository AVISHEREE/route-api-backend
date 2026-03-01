import express from "express";
import {
  saveSearchHistory,
  getSearchHistory
} from "../controllers/history.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/history", protect, saveSearchHistory);
router.get("/history", protect, getSearchHistory);

export default router;