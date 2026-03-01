import express from "express";
import {
  saveRoute,
  getSavedRoutes,
  deleteSavedRoute
} from "../controllers/savedRoute.controller.js";

import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/", protect, saveRoute);
router.get("/", protect, getSavedRoutes);
router.delete("/:id", protect, deleteSavedRoute);

export default router;