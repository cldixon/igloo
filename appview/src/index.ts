import { Hono } from "hono";
import { COLLECTIONS } from "@igloo/lexicon";

/**
 * The igloo AppView. Phase 1 adds, in order: the notifyRecord endpoint,
 * re-fetch from the author's PDS into D1, the feed and pages, the Jetstream
 * Durable Object and Queue, and the daily reconcile job.
 */
const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.json({ status: "ok", collections: COLLECTIONS }));

app.get("/", (c) => c.text("igloo AppView: nothing indexed yet.\n"));

export { app };
export default app;
