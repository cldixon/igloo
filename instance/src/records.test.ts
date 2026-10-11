import { describe, expect, test } from "bun:test";
import { NSID } from "@igloo/lexicon";
import type { DataDir } from "./db/dataDirs.js";
import { buildDataDirRecord } from "./records.js";

const HASH = "a".repeat(64);

const draft: DataDir = {
  slug: "wiki",
  title: "Wiki",
  description: null,
  license: "CC-BY-4.0",
  readmeSha256: HASH,
  tags: [],
  status: "draft",
  recordUri: null,
  recordCid: null,
  publishedAt: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  files: [
    {
      path: "a.parquet",
      size: 10,
      sha256: HASH,
      contentType: "application/vnd.apache.parquet",
      uploadedAt: "2026-10-01T00:00:00.000Z",
      format: null,
      rows: null,
      schema: null,
    },
  ],
};

describe("buildDataDirRecord", () => {
  test("builds a valid record, leaving out unset optional fields", () => {
    const result = buildDataDirRecord(
      draft,
      "https://data.cldixon.dev",
      "2026-10-02T18:12:00.000Z",
    );
    expect(result).toEqual({
      ok: true,
      value: {
        $type: NSID.dataDir,
        name: "wiki",
        instance: "https://data.cldixon.dev",
        title: "Wiki",
        license: "CC-BY-4.0",
        files: [{ path: "a.parquet", size: 10, sha256: HASH }],
        readme: { path: "README.md", sha256: HASH },
        createdAt: "2026-10-02T18:12:00.000Z",
      },
    });
  });

  test("carries measured schema, rows, format and tags", () => {
    const measured: DataDir = {
      ...draft,
      tags: ["web", "time-series"],
      files: [
        {
          ...draft.files[0]!,
          format: "parquet",
          rows: 3,
          schema: [{ name: "views", type: "BIGINT" }],
        },
      ],
    };
    const result = buildDataDirRecord(measured, "https://data.cldixon.dev");
    expect(result.ok && result.value.files[0]).toEqual({
      path: "a.parquet",
      size: 10,
      sha256: HASH,
      format: "parquet",
      rows: 3,
      schema: [{ name: "views", type: "BIGINT" }],
    });
    expect(result.ok && result.value.tags).toEqual(["web", "time-series"]);
  });

  test("keeps createdAt from the first publish", () => {
    const published = { ...draft, publishedAt: "2026-09-01T00:00:00.000Z" };
    const result = buildDataDirRecord(published, "https://data.cldixon.dev");
    expect(result.ok && result.value.createdAt).toBe("2026-09-01T00:00:00.000Z");
  });

  test("refuses a data dir with no files", () => {
    const result = buildDataDirRecord({ ...draft, files: [] }, "https://data.cldixon.dev");
    expect(result.ok).toBe(false);
  });
});
