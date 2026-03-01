import SearchHistory from "../models/SearchHistory.model.js";

const MAX_HISTORY = 4;

/**
 * BACKWARD-COMPAT STUB — kept so old transport controllers that haven't
 * been updated yet don't crash. It does nothing if userId is missing.
 *
 * Your old code called:  saveSearch(origin, destination, date)
 * That has no userId, so the DB write correctly failed validation.
 * This stub silently returns instead of hitting MongoDB.
 *
 * Once you replace all transport controllers with the new versions
 * (which remove the saveSearch call entirely), this function is unused
 * and can be deleted.
 */
export async function saveSearch(source, destination, date, userId) {
  if (!userId) return; // Guard: no userId = anonymous = don't save
  return upsertSearchHistory(userId, source, destination, date);
}

/**
 * Atomically upserts a search history record for an authenticated user.
 *
 * CONCURRENCY SAFETY:
 * findOneAndUpdate with { upsert: true } is a single atomic operation.
 * Two identical simultaneous searches: first creates, second updates
 * searchedAt. The unique compound index is the storage-level backstop.
 *
 * @param {ObjectId|string} userId
 * @param {string}          source
 * @param {string}          destination
 * @param {string}          date  — YYYY-MM-DD
 */
export async function upsertSearchHistory(userId, source, destination, date) {
  if (!userId || !source || !destination || !date) return;

  await SearchHistory.findOneAndUpdate(
    { user: userId, source, destination, date },
    { $set: { searchedAt: new Date() } },
    {
      upsert: true,
      /*
       * FIX: Mongoose deprecated { new: true } in favour of
       * { returnDocument: 'after' }. Using the new form silences
       * the "[MONGOOSE] Warning: the `new` option for findOneAndUpdate()
       * is deprecated" warning you see in the logs.
       */
      returnDocument: "after",
    }
  );

  // Enforce the 4-record cap
  const count = await SearchHistory.countDocuments({ user: userId });

  if (count > MAX_HISTORY) {
    const surplus = await SearchHistory
      .find({ user: userId })
      .sort({ searchedAt: -1 })
      .skip(MAX_HISTORY)
      .select("_id")
      .lean();

    if (surplus.length) {
      await SearchHistory.deleteMany({
        _id: { $in: surplus.map((d) => d._id) },
      });
    }
  }
}

/**
 * Returns the most recent searches for a user, newest first.
 *
 * @param {ObjectId|string} userId
 * @param {number}          limit
 * @returns {Array<{ source, destination, date, searchedAt }>}
 */
export async function getRecentSearches(userId, limit = MAX_HISTORY) {
  if (!userId) return [];

  return SearchHistory
    .find({ user: userId })
    .sort({ searchedAt: -1 })
    .limit(limit)
    .select("source destination date searchedAt -_id")
    .lean();
}