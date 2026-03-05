import { Hono } from "hono";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { toReqRes, toFetchResponse } from "fetch-to-node";
import { listObjects, getReadme, getObject, getObjectMetadata } from "./storage.js";
import { loadConfig } from "./routes/config.js";

// ---------------------------------------------------------------------------
// Text file detection
// ---------------------------------------------------------------------------

const TEXT_EXTENSIONS = new Set([
  "csv", "json", "jsonl", "ndjson",
  "md", "markdown", "txt", "text", "log",
  "yaml", "yml", "toml",
  "xml", "html", "htm", "css",
  "js", "ts", "jsx", "tsx",
  "py", "r", "sql",
  "sh", "bash", "zsh",
  "env", "ini", "cfg", "conf",
]);

const MAX_INLINE_SIZE = 1024 * 1024; // 1MB

function isTextFile(path: string, contentType?: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (TEXT_EXTENSIONS.has(ext)) return true;
  if (contentType?.startsWith("text/")) return true;
  if (contentType?.includes("json") || contentType?.includes("xml")) return true;
  return false;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

// ---------------------------------------------------------------------------
// MCP server factory — fresh instance per request (stateless mode)
// ---------------------------------------------------------------------------

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "igloo",
    version: "0.1.0",
  });

  server.registerTool(
    "igloo_health",
    {
      title: "Check Igloo Health",
      description: "Check the health of the igloo server. Returns the server status.",
      inputSchema: {},
    },
    async () => ({
      content: [{ type: "text" as const, text: JSON.stringify({ status: "ok" }, null, 2) }],
    })
  );

  server.registerTool(
    "igloo_list",
    {
      title: "List Directory Contents",
      description:
        "List files and directories at a given path in the igloo repository. " +
        "Returns directory entries with names, types, sizes, and modification dates. " +
        "If the directory contains a README.md, its content is included. " +
        "Omit the path or pass an empty string to list the root directory.",
      inputSchema: {
        path: z.string().optional().describe("Directory path to list. Empty or omitted for root."),
      },
    },
    async ({ path }) => {
      let normalizedPath = path ?? "";
      if (normalizedPath && !normalizedPath.endsWith("/")) {
        normalizedPath += "/";
      }

      const [entries, readme] = await Promise.all([
        listObjects(normalizedPath),
        getReadme(normalizedPath),
      ]);

      const lines: string[] = [];
      lines.push(`Path: ${normalizedPath || "/"}`);
      lines.push(`Entries: ${entries.length}`);
      lines.push("");

      for (const entry of entries) {
        if (entry.type === "directory") {
          lines.push(`  [DIR]  ${entry.name}/`);
        } else {
          const size = entry.size !== undefined ? formatBytes(entry.size) : "";
          const date = entry.lastModified
            ? new Date(entry.lastModified).toISOString().split("T")[0]
            : "";
          lines.push(`  [FILE] ${entry.name}  ${size}  ${date}`);
        }
      }

      if (readme) {
        lines.push("");
        lines.push("--- README.md ---");
        lines.push(readme);
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );

  server.registerTool(
    "igloo_metadata",
    {
      title: "Get File Metadata",
      description:
        "Get metadata for a specific file in the igloo repository. " +
        "Returns name, path, size, last modified date, content type, and etag.",
      inputSchema: {
        path: z.string().describe("File path to get metadata for."),
      },
    },
    async ({ path }) => {
      const meta = await getObjectMetadata(path);
      const formatted = [
        `Name:          ${meta.name}`,
        `Path:          ${meta.path}`,
        `Size:          ${formatBytes(meta.size)}`,
        `Last Modified: ${meta.lastModified}`,
        `Content Type:  ${meta.contentType}`,
        meta.etag ? `ETag:          ${meta.etag}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      return { content: [{ type: "text" as const, text: formatted }] };
    }
  );

  server.registerTool(
    "igloo_read_file",
    {
      title: "Read File Content",
      description:
        "Read the content of a file from the igloo repository. " +
        "For text-based files (CSV, JSON, Markdown, YAML, TXT, code files, etc.), " +
        "returns the file content inline. " +
        "For binary files (images, archives, PDFs, etc.), returns metadata and a download URL. " +
        "For large text files (>1MB), returns metadata and a download URL instead of inline content.",
      inputSchema: {
        path: z.string().describe("File path to read."),
      },
    },
    async ({ path }) => {
      const meta = await getObjectMetadata(path);

      if (isTextFile(path, meta.contentType) && meta.size <= MAX_INLINE_SIZE) {
        const response = await getObject(path);
        const content = await response.Body?.transformToString() ?? "";
        return {
          content: [{
            type: "text" as const,
            text: `File: ${meta.name} (${formatBytes(meta.size)}, ${meta.contentType})\n\n${content}`,
          }],
        };
      } else {
        const reason = !isTextFile(path, meta.contentType)
          ? "binary file"
          : "file too large for inline display";
        return {
          content: [{
            type: "text" as const,
            text: [
              `File: ${meta.name} (${reason})`,
              `Path: ${meta.path}`,
              `Size: ${formatBytes(meta.size)}`,
              `Type: ${meta.contentType}`,
              `Last Modified: ${meta.lastModified}`,
            ].join("\n"),
          }],
        };
      }
    }
  );

  server.registerTool(
    "igloo_config",
    {
      title: "Get Igloo Configuration",
      description: "Get the igloo instance configuration. Returns the instance title, tagline, and visual theme.",
      inputSchema: {},
    },
    async () => {
      const config = loadConfig();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(config, null, 2) }],
      };
    }
  );

  return server;
}

// ---------------------------------------------------------------------------
// Hono route — Streamable HTTP transport (stateless)
// ---------------------------------------------------------------------------

export const mcpRoute = new Hono();

mcpRoute.post("/", async (c) => {
  const { req, res } = toReqRes(c.req.raw);
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, await c.req.json());

  res.on("close", () => {
    transport.close();
    server.close();
  });

  return toFetchResponse(res);
});

mcpRoute.get("/", (c) => {
  return c.json({ error: "SSE not supported in stateless mode. Use POST." }, 405);
});

mcpRoute.delete("/", (c) => {
  return c.json({ error: "Session management not supported in stateless mode." }, 405);
});
