import cors from "cors";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { leaveRequestsRouter } from "./routes/leaveRequests.js";
import { employeesRouter } from "./routes/employees.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { openapiSpec } from "./docs/swagger.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.get("/docs.json", (_req, res) => res.json(openapiSpec));
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

  app.use("/leave-requests", leaveRequestsRouter);
  app.use("/employees", employeesRouter);

  app.use(errorHandler);
  return app;
}
