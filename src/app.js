import express from "express";
import routeRoutes from "./routes/routeRoutes.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();

app.use(express.json());
app.use("/api", routeRoutes);
app.use(errorHandler);

export default app;
