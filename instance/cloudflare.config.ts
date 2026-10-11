import { defineIgloo } from "./config.ts";

// The owner's settings (Worker name, bucket, domain, title) come from
// igloo.config.json, which `bun run setup` writes; see config.ts. Nothing
// specific to one instance belongs in this file. Owners who install the
// published package use the same defineIgloo, pointed at its prebuilt bundle.
export default defineIgloo({ dir: import.meta.dirname, entrypoint: "./src/worker.ts" });
