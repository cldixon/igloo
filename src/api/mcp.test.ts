import { describe, test, expect, mock, beforeEach, afterAll } from "bun:test";

// ---------------------------------------------------------------------------
// Mock storage and config before importing the app
// ---------------------------------------------------------------------------

const mockListObjects = mock(async () => []);
const mockGetReadme = mock(async () => null);
const mockGetObject = mock(
  async () =>
    ({ Body: { transformToString: async () => "" } }) as any
);
const mockGetObjectMetadata = mock(
  async () =>
    ({
      name: "test.csv",
      path: "test.csv",
      size: 100,
      lastModified: "2024-12-20T15:30:00.000Z",
      contentType: "text/csv",
      etag: '"abc123"',
    }) as any
);

mock.module("./storage.js", () => ({
  listObjects: mockListObjects,
  getReadme: mockGetReadme,
  getObject: mockGetObject,
  getObjectMetadata: mockGetObjectMetadata,
}));

import { Hono } from "hono";

mock.module("./routes/config.js", () => ({
  loadConfig: () => ({
    title: "test-igloo",
    tagline: "test tagline",
    theme: "repo",
  }),
  configRoute: new Hono(),
}));

const { app } = await import("./app.js");

// ---------------------------------------------------------------------------
// Start a real HTTP server (fetch-to-node needs real connections)
// ---------------------------------------------------------------------------

const server = Bun.serve({ port: 0, fetch: app.fetch });
const BASE = `http://localhost:${server.port}`;

afterAll(() => {
  server.stop(true);
});

// ---------------------------------------------------------------------------
// Helper: send a JSON-RPC request to /mcp and parse SSE response
// ---------------------------------------------------------------------------

async function mcpRequest(method: string, params?: object) {
  const res = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const text = await res.text();
  // The StreamableHTTP transport writes SSE lines: "data: {...}\n"
  const dataLine = text
    .split("\n")
    .find((l) => l.startsWith("data: "));
  if (!dataLine) {
    throw new Error(`No SSE data line in response:\n${text}`);
  }
  return { status: res.status, body: JSON.parse(dataLine.slice(6)) };
}

// ---------------------------------------------------------------------------
// Reset mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockListObjects.mockReset();
  mockGetReadme.mockReset();
  mockGetObject.mockReset();
  mockGetObjectMetadata.mockReset();

  // Restore default implementations
  mockListObjects.mockImplementation(async () => []);
  mockGetReadme.mockImplementation(async () => null);
  mockGetObject.mockImplementation(
    async () =>
      ({ Body: { transformToString: async () => "" } }) as any
  );
  mockGetObjectMetadata.mockImplementation(
    async () =>
      ({
        name: "test.csv",
        path: "test.csv",
        size: 100,
        lastModified: "2024-12-20T15:30:00.000Z",
        contentType: "text/csv",
        etag: '"abc123"',
      }) as any
  );
});

// ---------------------------------------------------------------------------
// HTTP method handling
// ---------------------------------------------------------------------------

describe("HTTP methods", () => {
  test("GET /mcp returns 405", async () => {
    const res = await fetch(`${BASE}/mcp`, { method: "GET" });
    expect(res.status).toBe(405);
  });

  test("DELETE /mcp returns 405", async () => {
    const res = await fetch(`${BASE}/mcp`, { method: "DELETE" });
    expect(res.status).toBe(405);
  });

  test("POST /mcp with tools/list returns all 5 tools", async () => {
    const { status, body } = await mcpRequest("tools/list", {});
    expect(status).toBe(200);

    const toolNames = body.result.tools.map((t: any) => t.name).sort();
    expect(toolNames).toEqual([
      "igloo_config",
      "igloo_health",
      "igloo_list",
      "igloo_metadata",
      "igloo_read_file",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Tool calls
// ---------------------------------------------------------------------------

describe("igloo_health", () => {
  test("returns status ok", async () => {
    const { body } = await mcpRequest("tools/call", {
      name: "igloo_health",
      arguments: {},
    });
    const text = body.result.content[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.status).toBe("ok");
  });
});

describe("igloo_list", () => {
  test("lists root directory with no path", async () => {
    mockListObjects.mockImplementationOnce(async () => [
      { name: "datasets", path: "datasets/", type: "directory" },
      {
        name: "readme.md",
        path: "readme.md",
        type: "file",
        size: 200,
        lastModified: "2024-12-20T15:30:00.000Z",
      },
    ]);

    const { body } = await mcpRequest("tools/call", {
      name: "igloo_list",
      arguments: {},
    });

    const text = body.result.content[0].text;
    expect(text).toContain("Path: /");
    expect(text).toContain("Entries: 2");
    expect(text).toContain("[DIR]  datasets/");
    expect(text).toContain("[FILE] readme.md");
    expect(mockListObjects).toHaveBeenCalledWith("");
  });

  test("normalizes path with trailing slash", async () => {
    mockListObjects.mockImplementationOnce(async () => []);

    const { body } = await mcpRequest("tools/call", {
      name: "igloo_list",
      arguments: { path: "datasets" },
    });

    const text = body.result.content[0].text;
    expect(text).toContain("Path: datasets/");
    expect(mockListObjects).toHaveBeenCalledWith("datasets/");
  });

  test("includes README content when present", async () => {
    mockListObjects.mockImplementationOnce(async () => []);
    mockGetReadme.mockImplementationOnce(async () => "# Test Readme\nHello world");

    const { body } = await mcpRequest("tools/call", {
      name: "igloo_list",
      arguments: { path: "data/" },
    });

    const text = body.result.content[0].text;
    expect(text).toContain("--- README.md ---");
    expect(text).toContain("# Test Readme");
  });
});

describe("igloo_metadata", () => {
  test("returns formatted metadata", async () => {
    mockGetObjectMetadata.mockImplementationOnce(async () => ({
      name: "iris.csv",
      path: "datasets/iris.csv",
      size: 4500,
      lastModified: "2024-12-20T15:30:00.000Z",
      contentType: "text/csv",
      etag: '"abc123"',
    }));

    const { body } = await mcpRequest("tools/call", {
      name: "igloo_metadata",
      arguments: { path: "datasets/iris.csv" },
    });

    const text = body.result.content[0].text;
    expect(text).toContain("Name:          iris.csv");
    expect(text).toContain("Path:          datasets/iris.csv");
    expect(text).toContain("4.4 KB");
    expect(text).toContain("Content Type:  text/csv");
    expect(text).toContain('ETag:          "abc123"');
  });
});

describe("igloo_read_file", () => {
  test("returns inline content for text files", async () => {
    mockGetObjectMetadata.mockImplementationOnce(async () => ({
      name: "data.csv",
      path: "data.csv",
      size: 50,
      lastModified: "2024-12-20T15:30:00.000Z",
      contentType: "text/csv",
    }));
    mockGetObject.mockImplementationOnce(
      async () =>
        ({
          Body: { transformToString: async () => "a,b,c\n1,2,3" },
        }) as any
    );

    const { body } = await mcpRequest("tools/call", {
      name: "igloo_read_file",
      arguments: { path: "data.csv" },
    });

    const text = body.result.content[0].text;
    expect(text).toContain("File: data.csv");
    expect(text).toContain("a,b,c\n1,2,3");
  });

  test("returns metadata only for binary files", async () => {
    mockGetObjectMetadata.mockImplementationOnce(async () => ({
      name: "photo.png",
      path: "images/photo.png",
      size: 204800,
      lastModified: "2024-12-20T15:30:00.000Z",
      contentType: "image/png",
    }));

    const { body } = await mcpRequest("tools/call", {
      name: "igloo_read_file",
      arguments: { path: "images/photo.png" },
    });

    const text = body.result.content[0].text;
    expect(text).toContain("binary file");
    expect(text).toContain("photo.png");
    expect(text).toContain("200.0 KB");
    // Should NOT have called getObject for binary
    expect(mockGetObject).not.toHaveBeenCalled();
  });
});

describe("igloo_config", () => {
  test("returns config JSON", async () => {
    const { body } = await mcpRequest("tools/call", {
      name: "igloo_config",
      arguments: {},
    });

    const text = body.result.content[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.title).toBe("test-igloo");
    expect(parsed.tagline).toBe("test tagline");
    expect(parsed.theme).toBe("repo");
  });
});
