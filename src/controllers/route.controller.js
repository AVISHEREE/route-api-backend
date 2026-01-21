import getTrains from '../services/trains.service.js';

export const findRoutes = async (req, res) => {
  const { source, destination, date } = req.body;

  if (!source || !destination || !date) {
    return res.status(400).json({
      error: "Source, destination and date are required"
    });
  }

  // Step 1: find direct trains
  const directTrains = await getTrains(source, destination, date);

  // Step 2: if direct exists → store
  // Step 3: if not → find transit stations (NEXT STEP)

  res.json({
    message: "Route search started",
    directTrainsCount: directTrains.length
  });
};
