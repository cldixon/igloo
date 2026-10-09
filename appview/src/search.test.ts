import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { migrate } from "@igloo/platform";
import { createTestD1 } from "@igloo/platform/testing";

mock.module("cloudflare:workers", () => ({ DurableObject: class {} }));

const { ALL_MIGRATIONS, deleteRecord, parseSearch, searchDataDirs, upsertDataDir } =
  await import("./db.js");
const { app } = await import("./index.js");
const { ALICE, BOB, dataDirRecord, dataDirUri } = await import("./test/network.js");

let db: D1Database;
let dispose: () => Promise<void>;

const schema = (...cols: [string, string][]) => cols.map(([name, type]) => ({ name, type }));

async function add(did: string, name: string, extra: Record<string, unknown>) {
  await upsertDataDir(
    db,
    { uri: dataDirUri(did, name), did, rkey: name, cid: "c" },
    dataDirRecord(name, extra) as never,
  );
}

beforeEach(async () => {
  ({ db, dispose } = await createTestD1());
  await migrate(db, ALL_MIGRATIONS);
  await add(ALICE, "usgs-sites", {
    title: "USGS stream gauges",
    tags: ["hydrology"],
    files: [
      {
        path: "sites.parquet",
        size: 1,
        sha256: "a".repeat(64),
        schema: schema(["site_id", "VARCHAR"], ["lat", "DOUBLE"], ["lon", "DOUBLE"]),
      },
    ],
    createdAt: "2026-10-01T00:00:00.000Z",
  });
  await add(BOB, "pageviews", {
    title: "Wikipedia pageviews",
    description: "Daily views, 100% of articles",
    tags: ["web", "time-series"],
    files: [
      {
        path: "views.parquet",
        size: 1,
        sha256: "b".repeat(64),
        schema: schema(["date", "DATE"], ["views", "BIGINT"]),
      },
    ],
    createdAt: "2026-10-02T00:00:00.000Z",
  });
});
afterEach(() => dispose());

const names = async (q: string) => (await searchDataDirs(db, parseSearch(q))).map((d) => d.rkey);

describe("parseSearch", () => {
  test("splits words and filters", () => {
    expect(parseSearch("  Gauges col:LAT type:date tag:Hydrology column:lon ")).toEqual({
      words: ["gauges"],
      columns: ["LAT", "lon"],
      types: ["DATE"],
      tags: ["hydrology"],
    });
  });
});

describe("searchDataDirs", () => {
  test("by columns, in any case", async () => {
    expect(await names("col:lat col:LON")).toEqual(["usgs-sites"]);
    expect(await names("col:lat col:views")).toEqual([]);
  });

  test("a bare word also matches a column name", async () => {
    expect(await names("lat")).toEqual(["usgs-sites"]);
  });

  test("by type, tag and text", async () => {
    expect(await names("type:date")).toEqual(["pageviews"]);
    expect(await names("type:double")).toEqual(["usgs-sites"]);
    expect(await names("tag:time-series")).toEqual(["pageviews"]);
    expect(await names("wikipedia")).toEqual(["pageviews"]);
    expect(await names("views.parquet")).toEqual(["pageviews"]);
  });

  test("LIKE wildcards in the query are literal", async () => {
    expect(await names("100%")).toEqual(["pageviews"]);
    expect(await names("%")).toEqual(["pageviews"]);
    // "_" is a single-character wildcard in LIKE; escaped, it matches only a real
    // underscore, and only the column site_id has one (columns match exactly).
    expect(await names("_")).toEqual([]);
  });

  test("an update replaces its columns and tags; a delete removes them", async () => {
    await add(ALICE, "usgs-sites", {
      tags: ["rivers"],
      files: [
        { path: "x.csv", size: 1, sha256: "c".repeat(64), schema: schema(["flow", "DOUBLE"]) },
      ],
    });
    expect(await names("col:lat")).toEqual([]);
    expect(await names("col:flow tag:rivers")).toEqual(["usgs-sites"]);
    await deleteRecord(db, dataDirUri(ALICE, "usgs-sites"));
    expect(await names("col:flow")).toEqual([]);
    const { results } = await db
      .prepare("SELECT count(*) AS n FROM data_dir_columns WHERE uri = ?")
      .bind(dataDirUri(ALICE, "usgs-sites"))
      .all<{ n: number }>();
    expect(results[0]?.n).toBe(0);
  });

  test("the migration backfills records indexed before it", async () => {
    const fresh = await createTestD1();
    const before = ALL_MIGRATIONS.filter((m) => m.name !== "0002_search");
    await migrate(fresh.db, before);
    await fresh.db
      .prepare(
        "INSERT INTO data_dirs (uri, did, rkey, cid, instance_url, record, created_at, indexed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        dataDirUri(ALICE, "old"),
        ALICE,
        "old",
        "c",
        "https://x.test",
        JSON.stringify(
          dataDirRecord("old", {
            tags: ["legacy"],
            files: [
              {
                path: "a.parquet",
                size: 1,
                sha256: "d".repeat(64),
                schema: schema(["elevation", "DOUBLE"]),
              },
            ],
          }),
        ),
        "2026-01-01",
        "2026-01-01",
      )
      .run();
    await migrate(fresh.db, ALL_MIGRATIONS);
    expect(
      (await searchDataDirs(fresh.db, parseSearch("col:elevation tag:legacy"))).map((d) => d.rkey),
    ).toEqual(["old"]);
    await fresh.dispose();
  });
});

describe("routes", () => {
  const env = () => ({ DB: db });
  test("the search page escapes the query and lists matches", async () => {
    const page = await (
      await app.request(
        `https://igloo.test/search?q=${encodeURIComponent('col:lat "><script>x</script>')}`,
        {},
        env(),
      )
    ).text();
    expect(page).not.toContain("<script>x</script>");
    expect(page).toContain("No data dirs match.");
    const hit = await (
      await app.request("https://igloo.test/search?q=col%3Alat", {}, env())
    ).text();
    expect(hit).toContain("USGS stream gauges");
  });

  test("the JSON API returns records", async () => {
    const body = await (
      await app.request("https://igloo.test/api/search?q=tag%3Aweb", {}, env())
    ).json<any>();
    expect(body.dataDirs.map((d: any) => d.record.name)).toEqual(["pageviews"]);
  });
});
