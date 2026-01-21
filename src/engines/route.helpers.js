// import { v4 as uuid } from "uuid";

// export function buildDirectTrainRoutes(trains, source, destination, date) {
//   const routes = [];

//   for (const train of trains) {
//     const segment = {
//       mode: "train",
//       number: train.trainNumber,
//       name: train.trainName,
//       type: train.type,

//       from: train.from,
//       to: train.to,

//       durationMinutes: train.durationMinutes,
//       distanceKm: train.distanceKm,
//       estimatedPrice: train.estimatedFare,
//       runningDays: train.runningDays
//     };

//     const route = {
//       routeId: uuid(),
//       segments: [segment],

//       origin: segment.from.stationCode,
//       destination: segment.to.stationCode,

//       transfers: 0,

//       totalTime: segment.durationMinutes,
//       totalDistance: segment.distanceKm,
//       totalPrice: segment.estimatedPrice,

//       score: 0 // scoring comes later
//     };

//     routes.push(route);
//   }

//   return routes;
// }
