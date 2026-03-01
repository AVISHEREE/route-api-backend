// controllers/savedRoute.controller.js

import SavedRoute from "../models/SavedRoute.model.js";

/* ================= SAVE ROUTE ================= */

export const saveRoute = async (req, res) => {
  try {
    const { routeData } = req.body;

    if (!req.user) {
      return res.status(401).json({ success: false });
    }

    const existing = await SavedRoute.findOne({
      user: req.user._id,
      "routeData.id": routeData.id
    });

    if (existing) {
      return res.json({ success: true, message: "Already saved" });
    }

    await SavedRoute.create({
      user: req.user._id,
      routeData
    });

    return res.json({ success: true });

  } catch (err) {
    console.error("Save Route Error:", err);
    return res.status(500).json({ success: false });
  }
};


/* ================= GET SAVED ROUTES ================= */

export const getSavedRoutes = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false });
    }

    const routes = await SavedRoute
      .find({ user: req.user._id })
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: routes
    });

  } catch (err) {
    console.error("Get Saved Routes Error:", err);
    return res.status(500).json({ success: false });
  }
};


/* ================= DELETE SAVED ROUTE ================= */

export const deleteSavedRoute = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false });
    }

    const { id } = req.params;

    await SavedRoute.findOneAndDelete({
      user: req.user._id,
      "routeData.id": id
    });

    return res.json({ success: true });

  } catch (err) {
    console.error("Delete Route Error:", err);
    return res.status(500).json({ success: false });
  }
};