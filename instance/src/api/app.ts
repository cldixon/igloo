import { Hono } from "hono";
import { cors } from "hono/cors";
import { listRoute } from "./routes/list.js";
import { downloadRoute } from "./routes/download.js";
import { metadataRoute } from "./routes/metadata.js";
import { configRoute } from "./routes/config.js";
import { mcpRoute } from "./mcp.js";
import type { Bindings } from "./bindings.js";

const app = new Hono<{ Bindings: Bindings }>();

// The web UI is same-origin now, but the CLI and MCP clients are not.
app.use("/api/*", cors());
app.use("/mcp", cors());
app.use("/health", cors());

app.get("/health", (c) => c.json({ status: "ok" }));

app.route("/api", listRoute);
app.route("/api", downloadRoute);
app.route("/api", metadataRoute);
app.route("/api", configRoute);
app.route("/mcp", mcpRoute);

const API_PREFIXES = ["/api", "/health", "/mcp"];

// Requests reach the Worker either because run_worker_first claimed them or
// because they missed a static asset. Unmatched API paths are a real 404;
// anything else belongs to the SPA.
app.notFound((c) => {
  const { pathname } = new URL(c.req.url);
  if (API_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

export { app };
