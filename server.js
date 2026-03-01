import app from "./src/app.js";
import { connectDB } from "./src/config/db.js";
import { logger } from "./src/services/logger.service.js";

await connectDB();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
