import mongoose from "mongoose";

const RouteResultSchema = new mongoose.Schema({
  source: String,
  destination: String,
  date: String,
  type: String,
  price: Number,
  duration: Number,
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("RouteResult", RouteResultSchema);

