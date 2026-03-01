import "./src/loadEnv.js"; 
import { findTrainBusSegment } from "./src/engines/segment.engine.js";

const source = {
    city: "Mumbai",
    code: "BDTS", 
    geo: { lat: 19.0544, lng: 72.8406 } 
};
const destination = {
    city: "Mount Abu",
    code: "MABU",
    geo: { lat: 24.5926, lng: 72.7156 }
};
const date = "2026-06-20";

import fs from 'fs';
const logStream = fs.createWriteStream('debug_log.txt', { flags: 'w' });
function fileLog(...args) {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ') + '\n';
    logStream.write(msg);
    process.stdout.write(msg);
}
console.log = fileLog;
console.error = fileLog;

console.log("Starting debug run for findTrainBusSegment...");

try {
    const result = await findTrainBusSegment(source, destination, date);
    console.log("Execution completed.");
    console.log("Result:", JSON.stringify(result, null, 2));
} catch (error) {
    console.error("Caught error at top level:", error);
}
