import { calculateFare } from "./fare.util.js";

function formatTrain(train) {
  const distance =
    train.toStationSchedule.distanceFromSourceKm -
    train.fromStationSchedule.distanceFromSourceKm;

  return {
    trainNumber: train.trainNumber,
    trainName: train.trainName,
    type: train.type,

    from: {
      stationCode: train.sourceStationCode,
      stationName: train.sourceStationName,
      departureMinutes: train.fromStationSchedule.departureMinutes,
      day: train.fromStationSchedule.day
    },

    to: {
      stationCode: train.destinationStationCode,
      stationName: train.destinationStationName,
      arrivalMinutes: train.toStationSchedule.arrivalMinutes,
      day: train.toStationSchedule.day
    },

    durationMinutes: train.travelTimeMinutes,
    distanceKm: Math.round(distance),

    estimatedFare: calculateFare(distance, train.type),

    runningDays: train.runningDays.days
  };
}

export { formatTrain };
