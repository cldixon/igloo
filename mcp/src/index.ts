#!/usr/bin/env bun

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { IglooClient } from "./client.js";
import { registerTools } from "./tools.js";

const IGLOO_API_URL = process.env.IGLOO_API_URL;

if (!IGLOO_API_URL) {
  console.error("Error: IGLOO_API_URL environment variable is required.");
  console.error(
    "Set it to the base URL of your igloo instance (e.g., https://my-igloo.example.com)"
  );
  process.exit(1);
}

const server = new McpServer({
  name: "igloo",
  version: "0.1.0",
});

const client = new IglooClient(IGLOO_API_URL);

registerTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);

console.error(`igloo MCP server connected (API: ${IGLOO_API_URL})`);
