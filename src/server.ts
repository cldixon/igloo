import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { app } from "./api/app.js";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = parseInt(process.env.PORT ?? "3000", 10);

function isApiRoute(url: string): boolean {
  return (
    url.startsWith("/api/") ||
    url.startsWith("/api?") ||
    url === "/api" ||
    url === "/health"
  );
}

function nodeToWebRequest(req: IncomingMessage): Request {
  const protocol = "http";
  const host = req.headers.host ?? "localhost";
  const url = `${protocol}://${host}${req.url}`;

  const headers = new Headers();
  for (const [key, val] of Object.entries(req.headers)) {
    if (val) headers.set(key, Array.isArray(val) ? val.join(", ") : val);
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? (req as unknown as ReadableStream) : undefined,
    // @ts-expect-error — duplex is required for streaming request bodies
    duplex: hasBody ? "half" : undefined,
  });
}

async function webToNodeResponse(
  webRes: Response,
  res: ServerResponse
): Promise<void> {
  const headers: Record<string, string> = {};
  webRes.headers.forEach((value, key) => {
    headers[key] = value;
  });
  res.writeHead(webRes.status, headers);

  if (webRes.body) {
    const reader = webRes.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  res.end();
}

async function start() {
  const buildDir = resolve(__dirname, "../web/build");
  const handlerPath = resolve(buildDir, "handler.js");

  try {
    await import("fs").then((fs) => fs.accessSync(handlerPath));
  } catch {
    console.error(
      "Error: web/build/ not found. Run `igloo build` first."
    );
    process.exit(1);
  }

  const { handler } = await import(handlerPath);

  const server = http.createServer(async (req, res) => {
    const url = req.url ?? "/";

    if (isApiRoute(url)) {
      try {
        const webReq = nodeToWebRequest(req);
        const webRes = await app.fetch(webReq);
        await webToNodeResponse(webRes, res);
      } catch (err) {
        console.error("API error:", err);
        if (!res.headersSent) {
          res.writeHead(500).end("Internal Server Error");
        }
      }
    } else {
      handler(req, res, () => {
        res.writeHead(404).end("Not found");
      });
    }
  });

  server.listen(port, () => {
    console.log(`igloo listening on http://localhost:${port}`);
  });
}

start();
