import dotenv from "dotenv/config";
import app from "./app.js";
import { findFlightTrainSegment, findTrainFlightSegment } from "./src/engines/route.engine.js";
const PORT = process.env.PORT || 5000;
const testTier1Connection = async () => {
const source = {
    code: "BIRD",
    name: "Bhiwandi Road",
    geo: { lat: 19.2813, lng: 73.0483 }
  };

  // DESTINATION: Jaipur Junction (JP)
  // Logic: Has a major Airport (JAI) and Railway Hub (JP)
  const destination = {
    code: "JP",
    name: "Jaipur Junction",
    geo: { lat: 26.9124, lng: 75.7873 }
  };
  console.log("🧪 Test 1: Tier-1 Flight -> Train (Mumbai ➔ Delhi ➔ Chandigarh)");
  const result1 = await findTrainFlightSegment(source, destination, "2026-02-09");
  console.log(JSON.stringify(result1, null, 2));
};
testTier1Connection();
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});

