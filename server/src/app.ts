import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import swaggerUi from "swagger-ui-express";
import { leaveRequestsRouter } from "./routes/leaveRequests.js";
import { employeesRouter } from "./routes/employees.js";
import { demoRouter } from "./routes/demo.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { openapiSpec } from "./docs/swagger.js";
import { failureResponse, successResponse } from "./utils/apiResponse.js";

/**
 * Paths owned by the API. A request under one of these must never fall through
 * to the single-page app, or a mistyped endpoint would answer with HTML instead
 * of a JSON error.
 */
const API_PREFIXES = ["/leave-requests", "/employees", "/demo", "/health", "/docs"];

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => successResponse(res, { data: { ok: true }, message: "Service is healthy." }));

  // Served raw, not wrapped: this is the OpenAPI document itself, and Swagger UI
  // and other tooling expect it in the standard shape.
  app.get("/docs.json", (_req, res) => res.json(openapiSpec));
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

  // Responses vary by the x-employee-id header while the URL stays the same —
  // /leave-requests/:id and ?status=pending look identical for every caller.
  // Caches key on the URL, so without this a browser or proxy could hand one
  // employee another's data, and switching user would show stale results.
  app.use(["/leave-requests", "/employees", "/demo"], (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("Vary", "x-employee-id");
    next();
  });

  app.use("/leave-requests", leaveRequestsRouter);
  app.use("/employees", employeesRouter);
  app.use("/demo", demoRouter);

  serveClient(app);

  // An unmatched path under an API prefix is a client error, not a page — answer
  // in the same envelope as everything else rather than Express's default HTML.
  app.use(API_PREFIXES, (req, res) =>
    failureResponse(res, {
      statusCode: 404,
      code: "not_found",
      message: `No endpoint matches ${req.method} ${req.baseUrl}${req.path}.`,
    }),
  );

  app.use(errorHandler);
  return app;
}

/**
 * In the production image the built frontend is copied to ./public and served
 * from the same origin as the API, so one container covers the whole app. In
 * development the directory is absent and Vite serves the client instead.
 */
function serveClient(app: express.Express) {
  const clientDir = path.resolve(process.cwd(), "public");
  if (!fs.existsSync(path.join(clientDir, "index.html"))) return;

  app.use(express.static(clientDir));

  // Client-side routes such as /team or /requests/:id are not files on disk;
  // hand them the shell and let the router resolve them.
  app.get("*", (req, res, next) => {
    if (API_PREFIXES.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`))) {
      return next();
    }
    res.sendFile(path.join(clientDir, "index.html"));
  });
}
