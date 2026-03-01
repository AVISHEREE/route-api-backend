import mongoose from "mongoose";

const savedRouteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    routeData: {
      type: Object,
      required: true
    }
  },
  { timestamps: true } // 🔥 THIS
);

savedRouteSchema.index({ user: 1, "routeData.id": 1 }, { unique: true }); // 🔥 Unique per user + route I D
export default mongoose.model("SavedRoute", savedRouteSchema);