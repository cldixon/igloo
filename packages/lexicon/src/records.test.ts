import { describe, expect, test } from "bun:test";
import { NSID } from "./nsid.ts";
import { validateDataDir, validateInstance, validateNotifyRecordInput } from "./records.ts";

const HASH_A = "9f2c".padEnd(64, "a");
const HASH_B = "41d0".padEnd(64, "b");
const HASH_R = "c71a".padEnd(64, "c");

/** The example record from the design handoff. */
const example = {
  $type: NSID.dataDir,
  name: "wikipedia-pageviews",
  instance: "https://data.cldixon.dev",
  title: "Wikipedia pageviews, 2026 Q3",
  description: "Daily article pageviews for English Wikipedia, top 100k articles.",
  license: "CC-BY-4.0",
  files: [
    { path: "pageviews-2026q3.parquet", size: 851443712, sha256: HASH_A },
    { path: "pageviews-2026q3.csv.gz", size: 2040109466, sha256: HASH_B },
  ],
  readme: { path: "README.md", sha256: HASH_R },
  createdAt: "2026-10-02T18:12:00Z",
};

function errorsOf(input: unknown): string[] {
  const result = validateDataDir(input);
  return result.ok ? [] : result.errors;
}

describe("dataDir", () => {
  test("accepts the design handoff example", () => {
    expect(validateDataDir(example)).toEqual({ ok: true, value: example });
  });

  test("accepts the minimal required fields", () => {
    const { title, description, license, readme, ...minimal } = example;
    expect(validateDataDir(minimal).ok).toBe(true);
  });

  test("ignores fields added by newer lexicon versions", () => {
    const result = validateDataDir({ ...example, version: "2026.3", tags: ["web"] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(example);
  });

  test.each([
    ["missing files", { ...example, files: [] }, "files"],
    ["wrong $type", { ...example, $type: "app.bsky.feed.post" }, "$type"],
    ["uppercase slug", { ...example, name: "Wiki" }, "name"],
    ["slug ending in a dash", { ...example, name: "wiki-" }, "name"],
    ["http instance", { ...example, instance: "http://data.cldixon.dev" }, "instance"],
    ["instance with a path", { ...example, instance: "https://data.cldixon.dev/x" }, "instance"],
    ["date without timezone", { ...example, createdAt: "2026-10-02T18:12:00" }, "createdAt"],
    [
      "uppercase hash",
      { ...example, files: [{ path: "a.csv", size: 1, sha256: HASH_A.toUpperCase() }] },
      "files.0.sha256",
    ],
    [
      "negative size",
      { ...example, files: [{ path: "a.csv", size: -1, sha256: HASH_A }] },
      "files.0.size",
    ],
    [
      "fractional size",
      { ...example, files: [{ path: "a.csv", size: 1.5, sha256: HASH_A }] },
      "files.0.size",
    ],
  ])("rejects %s", (_, input, field) => {
    expect(errorsOf(input).some((e) => e.startsWith(`${field}:`))).toBe(true);
  });

  test.each(["/abs.csv", "../escape.csv", "a/../b.csv", "a//b.csv", "./a.csv", "a\\b.csv", "a\nb"])(
    "rejects file path %p",
    (path) => {
      expect(errorsOf({ ...example, files: [{ path, size: 1, sha256: HASH_A }] })).not.toEqual([]);
    },
  );

  test("accepts nested file paths", () => {
    const files = [{ path: "splits/train.parquet", size: 1, sha256: HASH_A }];
    expect(validateDataDir({ ...example, files }).ok).toBe(true);
  });

  test("rejects duplicate file paths", () => {
    const files = [example.files[0], { ...example.files[0], sha256: HASH_B }];
    expect(errorsOf({ ...example, files })).toEqual(["files.1.path: duplicate path"]);
  });

  test("rejects a README that is also listed as a data file", () => {
    const files = [...example.files, { path: "README.md", size: 10, sha256: HASH_R }];
    expect(errorsOf({ ...example, files })[0]).toStartWith("readme.path:");
  });

  test("allows http on localhost for development", () => {
    expect(validateDataDir({ ...example, instance: "http://localhost:8787" }).ok).toBe(true);
  });
});

describe("instance", () => {
  const record = {
    $type: NSID.instance,
    url: "https://data.cldixon.dev",
    name: "cldixon's igloo",
    description: "Small public datasets I've collected or built.",
    createdAt: "2026-10-01T12:00:00Z",
  };

  test("accepts the design handoff example", () => {
    expect(validateInstance(record)).toEqual({ ok: true, value: record });
  });

  test("requires a name", () => {
    const { name, ...rest } = record;
    expect(validateInstance(rest).ok).toBe(false);
  });
});

describe("notifyRecord input", () => {
  const did = "did:plc:abcdefghijklmnopqrstuvwx";

  test("accepts a dataDir or instance URI", () => {
    expect(validateNotifyRecordInput({ uri: `at://${did}/${NSID.dataDir}/wiki` }).ok).toBe(true);
    expect(
      validateNotifyRecordInput({ uri: `at://${did}/${NSID.instance}/data.cldixon.dev` }).ok,
    ).toBe(true);
  });

  test("rejects other collections, handles and malformed URIs", () => {
    for (const uri of [
      `at://${did}/app.bsky.feed.post/3k`,
      `at://alice.bsky.social/${NSID.dataDir}/wiki`,
      `at://${did}/${NSID.dataDir}`,
      "https://example.com",
    ]) {
      expect(validateNotifyRecordInput({ uri }).ok).toBe(false);
    }
  });
});
