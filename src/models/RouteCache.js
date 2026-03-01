import mongoose from "mongoose";

const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL) || 1800;

const RouteCacheSchema = new mongoose.Schema({
  key: { type: String, unique: true },

  source: String,
  destination: String,
  date: String,
  type: String,

  data: Object,

  createdAt: {
    type: Date,
    default: Date.now,
    expires: CACHE_TTL_SECONDS
  }
});

export default mongoose.model("RouteCache", RouteCacheSchema);
