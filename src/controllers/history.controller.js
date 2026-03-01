import SearchHistory from "../models/SearchHistory.model.js";

export const saveSearchHistory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false });
    }

    const { source, destination, date } = req.body;

    if (!source || !destination || !date) {
      return res.status(400).json({ success: false });
    }

    // 🔥 Upsert ensures uniqueness automatically
    await SearchHistory.findOneAndUpdate(
      {
        user: req.user._id,
        source,
        destination,
        date,
      },
      {
        searchedAt: new Date(),
      },
      {
        upsert: true,
        returnDocument: "after",
      },
    );

    // 🔥 Keep only latest 4
    const histories = await SearchHistory.find({ user: req.user._id }).sort({
      searchedAt: -1,
    });

    if (histories.length > 4) {
      const toDelete = histories.slice(4);
      await SearchHistory.deleteMany({
        _id: { $in: toDelete.map((h) => h._id) },
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("History Save Error:", error);
    return res.status(500).json({ success: false });
  }
};

export const getSearchHistory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false });
    }

    const histories = await SearchHistory.find({
      user: req.user._id,
    })
      .sort({ searchedAt: -1 })
      .limit(4);

    return res.json({
      success: true,
      data: histories,
    });
  } catch (error) {
    console.error("History Fetch Error:", error);
    return res.status(500).json({ success: false });
  }
};
