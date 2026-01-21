import axios from "axios";
import { config } from "./config.service.js";

const SERP_API_KEY = config.serp.apiKey;

function formatFlights(data, limit = 5) {
  const allFlights = [
    ...(data.best_flights || []),
    ...(data.other_flights || [])
  ];

  const flights = allFlights
    .filter(f => f.price && f.flights?.length)
    .map(flight => {
      const leg = flight.flights[0];
      const stops = flight.layovers ? flight.layovers.length : 0;

      return {
        airline: leg.airline,
        flightNumber: leg.flight_number,
        departure: {
          airport: leg.departure_airport.id,
          time: leg.departure_airport.time
        },
        arrival: {
          airport: leg.arrival_airport.id,
          time: leg.arrival_airport.time
        },
        durationMinutes: leg.duration,
        stops,
        price: flight.price,
        currency: "INR"
      };
    });

  // NORMALIZATION
  const maxPrice = Math.max(...flights.map(f => f.price));
  const maxDuration = Math.max(...flights.map(f => f.durationMinutes));

  const scoredFlights = flights.map(f => {
    const priceScore = f.price / maxPrice;
    const durationScore = f.durationMinutes / maxDuration;
    const stopScore = f.stops / 2; // assume max 2 stops

    const totalScore =
      priceScore * 0.5 +
      durationScore * 0.35 +
      stopScore * 0.15;

    return { ...f, score: totalScore };
  });

  return scoredFlights
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);
}




export async function searchFlights(query) {
  const {
    source,
    destination,
    outboundDate,
    returnDate,
    type = 2,
    sort = "best"
  } = query;

  const params = {
    engine: "google_flights",
    departure_id: source,
    arrival_id: destination,
    outbound_date: outboundDate,
    gl: "in",
    currency: "INR",
    type,
    api_key: SERP_API_KEY
  };

  if (type === 1) params.return_date = returnDate;

  const { data } = await axios.get(
    "https://serpapi.com/search.json",
    { params }
  );

  return formatFlights(data, 5);
}


// const abc = async () => {
//   const result = await searchFlights({
//     source: "BOM",
//     destination: "AMD",
//     outboundDate: "2026-01-05",
//     sort: "best"
//   });
//   console.log(result);
// };

// abc();
