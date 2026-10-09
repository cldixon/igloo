import { describe, expect, test } from "bun:test";
import { COLLECTIONS } from "@igloo/lexicon";
import { app } from "./index.ts";

describe("AppView", () => {
  test("health reports the collections it indexes", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json<unknown>()).toEqual({ status: "ok", collections: [...COLLECTIONS] });
  });
});
