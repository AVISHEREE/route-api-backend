import mongoose from "mongoose";

const SearchHistorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  source: {
    type: String,
    required: true
  },

  destination: {
    type: String,
    required: true
  },

  date: {
    type: String,
    required: true
  },

  searchedAt: {
    type: Date,
    default: Date.now
  }
});

// 🔥 Unique per (user + source + destination + date)
SearchHistorySchema.index(
  { user: 1, source: 1, destination: 1, date: 1 },
  { unique: true }
);

// 🔥 Fast sorting for recent searches
SearchHistorySchema.index({ user: 1, searchedAt: -1 });

export default mongoose.model("SearchHistory", SearchHistorySchema);