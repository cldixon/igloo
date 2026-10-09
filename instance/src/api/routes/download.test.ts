import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createTestBindings } from "@igloo/platform/testing";
import { downloadRoute, parseRange } from "./download.js";

describe("parseRange", () => {
  test.each([
    ["bytes=0-9", 100, { offset: 0, length: 10 }],
    ["bytes=90-", 100, { offset: 90 }],
    ["bytes=-10", 100, { suffix: 10 }],
    ["bytes=-500", 100, { suffix: 100 }],
    ["bytes=95-200", 100, { offset: 95, length: 5 }],
    ["bytes=100-", 100, "unsatisfiable"],
    ["bytes=9-3", 100, "unsatisfiable"],
    ["bytes=-0", 100, "unsatisfiable"],
    ["bytes=0-1,5-6", 100, null],
    ["items=0-1", 100, null],
    [undefined, 100, null],
  ] as const)("%p of %d bytes", (header, size, expected) => {
    expect(parseRange(header, size)).toEqual(expected as never);
  });
});

describe("GET/HEAD /download", () => {
  const BODY = "0123456789abcdefghij";
  let env: Record<string, unknown>;
  let dispose: () => Promise<void>;

  beforeEach(async () => {
    const b = await createTestBindings();
    dispose = b.dispose;
    await b.bucket.put("wiki/data.parquet", new TextEncoder().encode(BODY), {
      httpMetadata: { contentType: "application/vnd.apache.parquet" },
    });
    env = { DATA: b.bucket };
  });
  afterEach(() => dispose());

  const req = (init: RequestInit = {}, path = "wiki/data.parquet") =>
    downloadRoute.request(`/download?path=${encodeURIComponent(path)}`, init, env);

  test("whole file", async () => {
    const res = await req();
    expect(res.status).toBe(200);
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("content-length")).toBe("20");
    expect(res.headers.get("content-type")).toBe("application/vnd.apache.parquet");
    expect(await res.text()).toBe(BODY);
  });

  test("HEAD gives the size without a body", async () => {
    const res = await req({ method: "HEAD" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-length")).toBe("20");
    expect(await res.text()).toBe("");
  });

  test("a byte range", async () => {
    const res = await req({ headers: { range: "bytes=2-5" } });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 2-5/20");
    expect(res.headers.get("content-length")).toBe("4");
    expect(await res.text()).toBe("2345");
  });

  test("the last bytes, as Parquet readers ask for the footer", async () => {
    const res = await req({ headers: { range: "bytes=-4" } });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 16-19/20");
    expect(await res.text()).toBe("ghij");
  });

  test("open-ended range", async () => {
    const res = await req({ headers: { range: "bytes=15-" } });
    expect(res.headers.get("content-range")).toBe("bytes 15-19/20");
    expect(await res.text()).toBe("fghij");
  });

  test("past the end is 416", async () => {
    const res = await req({ headers: { range: "bytes=50-60" } });
    expect(res.status).toBe(416);
    expect(res.headers.get("content-range")).toBe("bytes */20");
  });

  test("missing file and missing path", async () => {
    expect((await req({}, "nope")).status).toBe(404);
    expect((await downloadRoute.request("/download", {}, env)).status).toBe(400);
  });
});
