import dotenv from "dotenv/config";
import app from "./app.js";
import { findTrainFlightSegment } from "./src/engines/route.engine.js";
const PORT = process.env.PORT || 5000;
const test = async () => {
  // SOURCE: Bhiwandi (BIRD)
  const source = {
    code: "BSR",
    name: "Vasai Road",
    geo: { lat: 19.3792, lng: 72.8273 }
  };

  // DESTINATION: Jaipur (JP)
  const destination = {
    code: "JP",
    name: "Jaipur Junction",
    geo: { lat: 26.9124, lng: 75.7873 }
  };

  console.log(`🚀 Routing from ${source.name} to ${destination.name}...`);

  try {
    const result = await findTrainFlightSegment(
      source,
      destination,
      "2026-02-20"
    );

    if (!result || result.length === 0) {
      console.log("No indirect segments found for these hubs.");
    } else {
      console.log("--- Route Results ---");
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error("❌ Error executing findTwoIndirectTrainSegments:", error.message);
  }
};

test();
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});

