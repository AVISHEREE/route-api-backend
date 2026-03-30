export function logError(error, context = "") {
  console.error("====================================");
  console.error("❌ ERROR OCCURRED", context ? `(${context})` : "");
  console.error("Message:", error.message);
  console.error("Stack Trace:\n", error.stack);
  console.error("====================================");
}

