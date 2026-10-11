import { Hono } from "hono";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { toReqRes, toFetchResponse } from "fetch-to-node";
import { listObjects, getReadme, getObject, getObjectMetadata } from "./storage.js";
import { loadConfig } from "./routes/config.js";
import type { Bindings } from "./bindings.js";
import { bearerToken, verifyApiToken } from "../auth/tokens.js";
import { getDb } from "../db/migrations.js";
import { getDataDir, listDataDirs } from "../db/dataDirs.js";
import { adminRoute } from "./routes/admin.js";
import { publicDataDir } from "./routes/datadirs.js";

// ---------------------------------------------------------------------------
// Text file detection
// ---------------------------------------------------------------------------

const TEXT_EXTENSIONS = new Set([
  "csv",
  "json",
  "jsonl",
  "ndjson",
  "md",
  "markdown",
  "txt",
  "text",
  "log",
  "yaml",
  "yml",
  "toml",
  "xml",
  "html",
  "htm",
  "css",
  "js",
  "ts",
  "jsx",
  "tsx",
  "py",
  "r",
  "sql",
  "sh",
  "bash",
  "zsh",
  "env",
  "ini",
  "cfg",
  "conf",
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

type McpContext = {
  /** This instance's public origin. */
  origin: string;
  /** Set when the request carried a valid API token: enables the write tools. */
  authorization?: string;
};

const json = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

function createMcpServer(env: Bindings, ctx: McpContext): McpServer {
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
    }),
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
        listObjects(env.DATA, normalizedPath),
        getReadme(env.DATA, normalizedPath),
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
    },
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
      const meta = await getObjectMetadata(env.DATA, path);
      if (!meta) {
        return { content: [{ type: "text" as const, text: `File not found: ${path}` }] };
      }

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
    },
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
      const meta = await getObjectMetadata(env.DATA, path);
      if (!meta) {
        return { content: [{ type: "text" as const, text: `File not found: ${path}` }] };
      }

      if (isTextFile(path, meta.contentType) && meta.size <= MAX_INLINE_SIZE) {
        const object = await getObject(env.DATA, path);
        const content = object ? await object.text() : "";
        return {
          content: [
            {
              type: "text" as const,
              text: `File: ${meta.name} (${formatBytes(meta.size)}, ${meta.contentType})\n\n${content}`,
            },
          ],
        };
      } else {
        const reason = !isTextFile(path, meta.contentType)
          ? "binary file"
          : "file too large for inline display";
        return {
          content: [
            {
              type: "text" as const,
              text: [
                `File: ${meta.name} (${reason})`,
                `Path: ${meta.path}`,
                `Size: ${formatBytes(meta.size)}`,
                `Type: ${meta.contentType}`,
                `Last Modified: ${meta.lastModified}`,
              ].join("\n"),
            },
          ],
        };
      }
    },
  );

  server.registerTool(
    "igloo_config",
    {
      title: "Get Igloo Configuration",
      description:
        "Get the igloo instance configuration. Returns the instance title, tagline, and visual theme.",
      inputSchema: {},
    },
    async () => {
      const config = loadConfig(env);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(config, null, 2) }],
      };
    },
  );

  // --- Data dirs (read) -----------------------------------------------------

  server.registerTool(
    "igloo_list_datadirs",
    {
      title: "List Published Data Dirs",
      description:
        "List this instance's published data dirs: name, title, description, license, tags, " +
        "and each file's path, size, sha256, format, row count and schema.",
      inputSchema: {},
    },
    async () => {
      const db = await getDb(env.DB);
      const dirs = (await listDataDirs(db)).filter((d) => d.status === "published");
      return json(dirs.map((d) => publicDataDir(d, ctx.origin, env.IGLOO_APPVIEW_URL)));
    },
  );

  server.registerTool(
    "igloo_get_datadir",
    {
      title: "Get a Data Dir",
      description:
        "Get one published data dir with its files' download URLs, sha256 hashes, formats, " +
        "row counts and column schemas, plus its AT Protocol record URI. Download URLs support " +
        "HTTP range requests, so Parquet can be read selectively (e.g. by DuckDB).",
      inputSchema: { name: z.string().describe("The data dir's name, e.g. wikipedia-pageviews") },
    },
    async ({ name }) => {
      const dir = await getDataDir(await getDb(env.DB), name);
      if (!dir || dir.status !== "published") {
        return { ...json({ error: `No published data dir "${name}"` }), isError: true };
      }
      return json(publicDataDir(dir, ctx.origin, env.IGLOO_APPVIEW_URL));
    },
  );

  // --- Data dirs (write, with an API token) ----------------------------------

  if (ctx.authorization) {
    /** The admin API, called as the token's holder. */
    const admin = async (method: string, path: string, body?: unknown) => {
      const res = await adminRoute.request(
        new URL(path, ctx.origin),
        {
          method,
          headers: {
            authorization: ctx.authorization!,
            ...(typeof body === "string"
              ? { "content-type": "text/markdown" }
              : body !== undefined && { "content-type": "application/json" }),
          },
          body:
            typeof body === "string" ? body : body === undefined ? undefined : JSON.stringify(body),
        },
        env,
      );
      const data = await res.json();
      return res.ok ? json(data) : { ...json(data), isError: true };
    };
    const dir = (name: string) => `/datadirs/${encodeURIComponent(name)}`;

    server.registerTool(
      "igloo_create_datadir",
      {
        title: "Create a Data Dir",
        description:
          "Create a draft data dir. Its name is its folder in the bucket. Add files with " +
          "igloo_add_files (files already in the folder) or the REST upload API, then publish.",
        inputSchema: {
          name: z.string(),
          title: z.string().optional(),
          description: z.string().optional(),
          license: z.string().optional().describe("SPDX identifier, e.g. CC-BY-4.0"),
        },
      },
      ({ name, ...fields }) => admin("POST", "/datadirs", { slug: name, ...fields }),
    );

    server.registerTool(
      "igloo_add_files",
      {
        title: "Add Files Already in the Bucket",
        description:
          "Add files that are already in the bucket under <name>/ to a draft data dir. Each is " +
          "hashed (and Parquet profiled) on the server.",
        inputSchema: {
          name: z.string(),
          paths: z.array(z.string()).describe("Paths within the data dir"),
        },
      },
      ({ name, paths }) => admin("POST", `${dir(name)}/files/register`, { paths }),
    );

    server.registerTool(
      "igloo_update_datadir",
      {
        title: "Update a Data Dir",
        description:
          "Change a data dir's title, description, tags or license. Title, description and tags " +
          "can change while published (the record is updated); the license can't.",
        inputSchema: {
          name: z.string(),
          title: z.string().optional(),
          description: z.string().optional(),
          tags: z.array(z.string()).optional(),
          license: z.string().optional(),
        },
      },
      ({ name, ...fields }) => admin("PATCH", dir(name), fields),
    );

    server.registerTool(
      "igloo_set_readme",
      {
        title: "Set a Data Dir's README",
        description: "Write the data dir's README.md (markdown). Allowed while published.",
        inputSchema: { name: z.string(), markdown: z.string() },
      },
      ({ name, markdown }) => admin("PUT", `${dir(name)}/readme`, markdown),
    );

    server.registerTool(
      "igloo_publish_datadir",
      {
        title: "Publish a Data Dir",
        description:
          "Publish a data dir: write its record to the owner's AT Protocol repo and announce it " +
          "to the AppView. Its files and license are then fixed until it is unpublished.",
        inputSchema: { name: z.string() },
      },
      ({ name }) => admin("POST", `${dir(name)}/publish`),
    );

    server.registerTool(
      "igloo_unpublish_datadir",
      {
        title: "Unpublish a Data Dir",
        description:
          "Delete the data dir's record. It leaves the feed and becomes an editable draft.",
        inputSchema: { name: z.string() },
      },
      ({ name }) => admin("POST", `${dir(name)}/unpublish`),
    );
  }

  return server;
}

// ---------------------------------------------------------------------------
// Hono route — Streamable HTTP transport (stateless)
// ---------------------------------------------------------------------------

export const mcpRoute = new Hono<{ Bindings: Bindings }>();

mcpRoute.post("/", async (c) => {
  // Reading is open. An API token (Authorization: Bearer igloo_…) adds the write tools.
  const authorization = c.req.header("authorization");
  const token = bearerToken(authorization);
  if (token && !(await verifyApiToken(await getDb(c.env.DB), token))) {
    return c.json({ error: "Invalid or expired API token" }, 401);
  }
  const { req, res } = toReqRes(c.req.raw);
  const server = createMcpServer(c.env, {
    origin: new URL(c.req.url).origin,
    authorization: token ? authorization : undefined,
  });
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
