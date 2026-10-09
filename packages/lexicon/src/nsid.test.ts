import { describe, expect, test } from "bun:test";
import { COLLECTIONS, NAMESPACE, NSID } from "./nsid.ts";

describe("lexicon NSIDs", () => {
  test("every NSID lives under the namespace", () => {
    for (const nsid of Object.values(NSID)) {
      expect(nsid.startsWith(`${NAMESPACE}.`)).toBe(true);
    }
  });

  test("NSIDs are valid: reverse-domain authority plus a camelCase name", () => {
    const valid = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+\.[a-zA-Z][a-zA-Z0-9]*$/;
    for (const nsid of Object.values(NSID)) {
      expect(nsid).toMatch(valid);
    }
  });

  test("the AppView subscribes to records, not to the XRPC method", () => {
    expect(COLLECTIONS as readonly string[]).not.toContain(NSID.notifyRecord);
  });
});
