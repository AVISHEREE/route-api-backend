import { calculateFare } from "./fare.util.js";

function formatTrain(train) {
  const fromSchedule = train?.fromStationSchedule || {};
  const toSchedule = train?.toStationSchedule || {};
  const distance =
    (toSchedule.distanceFromSourceKm ?? 0) -
    (fromSchedule.distanceFromSourceKm ?? 0);

  return {
    trainNumber: train?.trainNumber,
    trainName: train?.trainName,
    type: train?.type,

    from: {
      stationCode: train?.sourceStationCode,
      stationName: train?.sourceStationName,
      departureMinutes: fromSchedule.departureMinutes,
      day: fromSchedule.day
    },

    to: {
      stationCode: train?.destinationStationCode,
      stationName: train?.destinationStationName,
      arrivalMinutes: toSchedule.arrivalMinutes,
      day: toSchedule.day
    },

    durationMinutes: train?.travelTimeMinutes,
    distanceKm: Math.round(distance),

    estimatedFare: calculateFare(Math.max(0, distance), train?.type),

    runningDays: train?.runningDays?.days || []
  };
}

export { formatTrain };
