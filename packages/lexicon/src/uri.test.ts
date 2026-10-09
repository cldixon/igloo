import { describe, expect, test } from "bun:test";
import { formatAtUri, instanceRkey, isDid, isSlug, parseAtUri } from "./uri.ts";

describe("AT URIs", () => {
  const uri = {
    did: "did:plc:abcdefghijklmnopqrstuvwx",
    collection: "dev.cldixon.igloo.dataDir",
    rkey: "wikipedia-pageviews",
  };

  test("round-trip", () => {
    expect(parseAtUri(formatAtUri(uri))).toEqual(uri);
  });

  test("accepts did:web authorities", () => {
    expect(
      parseAtUri("at://did:web:someone.org/dev.cldixon.igloo.instance/igloo.someone.org"),
    ).not.toBeNull();
  });

  test.each([
    "at://did:plc:abcdefghijklmnopqrstuvwx/dev.cldixon.igloo.dataDir/..",
    "at://did:plc:short/dev.cldixon.igloo.dataDir/x",
    "at://did:plc:abcdefghijklmnopqrstuvwx/not-an-nsid/x",
    "at://did:plc:abcdefghijklmnopqrstuvwx/dev.cldixon.igloo.dataDir/x/extra",
  ])("rejects %p", (bad) => {
    expect(parseAtUri(bad)).toBeNull();
  });
});

test("isDid", () => {
  expect(isDid("did:plc:abcdefghijklmnopqrstuvwx")).toBe(true);
  expect(isDid("did:web:data.cldixon.dev")).toBe(true);
  expect(isDid("did:key:z6Mk")).toBe(false);
});

test("isSlug accepts the existing data-repo folders", () => {
  for (const slug of ["cspan-booknotes", "in-our-time", "usbr", "a", "v1.2_final"]) {
    expect(isSlug(slug)).toBe(true);
  }
  for (const slug of ["", "-a", "a-", "A", "a b", "a/b", "x".repeat(65)]) {
    expect(isSlug(slug)).toBe(false);
  }
});

test("instanceRkey is the host, port included", () => {
  expect(instanceRkey("https://data.cldixon.dev")).toBe("data.cldixon.dev");
  expect(instanceRkey("http://localhost:8787")).toBe("localhost:8787");
});
