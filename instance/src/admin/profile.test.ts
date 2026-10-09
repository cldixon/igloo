import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { parquetWriteBuffer } from "hyparquet-writer";
import { createTestBindings } from "@igloo/platform/testing";
import { formatOf, profileFile } from "./profile.js";

describe("formatOf", () => {
  test.each([
    ["a/b/data.parquet", "parquet"],
    ["data.csv", "csv"],
    ["data.csv.gz", "csv"],
    ["events.ndjson", "jsonl"],
    ["DATA.TSV", "tsv"],
    ["notes.txt", null],
    ["Makefile", null],
  ])("%s → %p", (path, format) => {
    expect(formatOf(path)).toBe(format);
  });
});

describe("profileFile", () => {
  let bucket: R2Bucket;
  let dispose: () => Promise<void>;
  beforeEach(async () => ({ bucket, dispose } = await createTestBindings()));
  afterEach(() => dispose());

  test("reads row count and schema from a Parquet footer", async () => {
    const parquet = parquetWriteBuffer({
      columnData: [
        { name: "station", data: ["a", "b", "c"], type: "STRING" },
        { name: "flow", data: [1.5, 2.25, 3], type: "DOUBLE" },
        { name: "count", data: [1n, 2n, 3n], type: "INT64" },
        { name: "ok", data: [true, false, true], type: "BOOLEAN" },
        {
          name: "day",
          data: [new Date("2026-01-01"), new Date("2026-01-02"), new Date("2026-01-03")],
          type: "TIMESTAMP",
        },
      ],
    });
    await bucket.put("usbr/flows.parquet", new Uint8Array(parquet));
    const profile = await profileFile(bucket, "usbr/flows.parquet", parquet.byteLength);
    expect(profile).toEqual({
      format: "parquet",
      rows: 3,
      schema: [
        { name: "station", type: "VARCHAR" },
        { name: "flow", type: "DOUBLE" },
        { name: "count", type: "BIGINT" },
        { name: "ok", type: "BOOLEAN" },
        { name: "day", type: "TIMESTAMP" },
      ],
    });
  });

  test("a file that isn't really Parquet still gets its format, without failing", async () => {
    await bucket.put("x/broken.parquet", "not parquet at all");
    expect(await profileFile(bucket, "x/broken.parquet", 18)).toEqual({ format: "parquet" });
  });

  test("CSV is left for the browser to measure", async () => {
    await bucket.put("x/a.csv", "a,b\n1,2\n");
    expect(await profileFile(bucket, "x/a.csv", 8)).toEqual({ format: "csv" });
  });
});
