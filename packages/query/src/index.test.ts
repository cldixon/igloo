import { expect, test } from "bun:test";
import {
  guessFormat,
  mountQueryPanel,
  loadDuckDB,
  measureFile,
  queryFiles,
  tableNames,
} from "./index.ts";

test("guessFormat", () => {
  expect(guessFormat("a/flows.parquet")).toBe("parquet");
  expect(guessFormat("sites.csv.gz")).toBe("csv");
  expect(guessFormat("README")).toBeNull();
});

test("table names are short, unless they'd collide", () => {
  expect([...tableNames(["flows.parquet", "train/x.csv", "test/x.csv"])]).toEqual([
    ["flows.parquet", "flows"],
    ["train/x.csv", "train/x.csv"],
    ["test/x.csv", "test/x.csv"],
  ]);
});

test("queryFiles skips formats DuckDB can't read here", () => {
  const files = queryFiles(
    [{ path: "flows.parquet", format: "parquet" }, { path: "notes.txt" }, { path: "sites.csv" }],
    (p) => `https://i.test/api/download?path=d%2F${p}`,
  );
  expect(files).toEqual([
    { name: "flows", url: "https://i.test/api/download?path=d%2Fflows.parquet", format: "parquet" },
    { name: "sites", url: "https://i.test/api/download?path=d%2Fsites.csv", format: "csv" },
  ]);
});

test("the inlined functions don't reference module scope", () => {
  // The AppView ships these with Function.prototype.toString(); a reference to
  // anything outside the function body would be undefined in the page.
  for (const fn of [loadDuckDB, mountQueryPanel, measureFile]) {
    const body = fn.toString();
    for (const name of [
      "DUCKDB_CDN",
      "DUCKDB_VERSION",
      "guessFormat",
      "tableNames",
      "QUERY_PANEL_CSS",
    ]) {
      expect(body).not.toContain(name);
    }
  }
});

test("types.d.ts declares every export", async () => {
  const declared = await Bun.file(new URL("../types.d.ts", import.meta.url)).text();
  const mod = await import("./index.ts");
  for (const name of Object.keys(mod)) expect(declared).toContain(` ${name}`);
});
