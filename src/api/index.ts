import { app } from "./app.js";

const port = parseInt(process.env.PORT ?? "3001", 10);

export default {
  port,
  fetch: app.fetch,
};

console.log(`igloo api listening on http://localhost:${port}`);
