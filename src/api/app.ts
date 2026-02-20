import { Hono } from "hono";
import { cors } from "hono/cors";
import { listRoute } from "./routes/list.js";
import { downloadRoute } from "./routes/download.js";
import { metadataRoute } from "./routes/metadata.js";
import { configRoute } from "./routes/config.js";

const app = new Hono();

app.use("/*", cors());

app.get("/health", (c) => c.json({ status: "ok" }));

app.route("/api", listRoute);
app.route("/api", downloadRoute);
app.route("/api", metadataRoute);
app.route("/api", configRoute);

export { app };
