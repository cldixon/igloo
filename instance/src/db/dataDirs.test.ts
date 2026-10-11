import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createTestD1 } from "@igloo/platform/testing";
import { migrate } from "@igloo/platform";
import { ALL_MIGRATIONS } from "./migrations.js";
import {
  DataDirError,
  createDataDir,
  deleteDataDir,
  getDataDir,
  listDataDirs,
  markPublished,
  markUnpublished,
  putFile,
  removeFile,
  setLicense,
  setReadme,
  updateMetadata,
} from "./dataDirs.js";

const HASH = "a".repeat(64);
const HASH2 = "b".repeat(64);
const RECORD = {
  uri: "at://did:plc:abcdefghijklmnopqrstuvwx/dev.cldixon.igloo.dataDir/wiki",
  cid: "bafyreiexample",
  publishedAt: "2026-10-02T18:12:00.000Z",
};

let db: D1Database;
let dispose: () => Promise<void>;

beforeEach(async () => {
  ({ db, dispose } = await createTestD1());
  await migrate(db, ALL_MIGRATIONS);
});
afterEach(() => dispose());

async function expectError(promise: Promise<unknown>, code: DataDirError["code"]) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(DataDirError);
  expect((error as DataDirError).code).toBe(code);
}

async function publishedWiki() {
  await createDataDir(db, "wiki", { title: "Wiki", license: "CC-BY-4.0" });
  await putFile(db, "wiki", { path: "a.parquet", size: 10, sha256: HASH });
  return markPublished(db, "wiki", RECORD);
}

describe("creating", () => {
  test("starts as an empty draft with trimmed metadata", async () => {
    const dir = await createDataDir(db, "wiki", { title: "  Wiki  ", description: "" });
    expect(dir).toMatchObject({
      slug: "wiki",
      title: "Wiki",
      description: null,
      status: "draft",
      files: [],
      recordUri: null,
    });
  });

  test("rejects invalid and duplicate names", async () => {
    await expectError(createDataDir(db, "Not A Slug"), "invalid");
    await createDataDir(db, "wiki");
    await expectError(createDataDir(db, "wiki"), "exists");
  });

  test("lists data dirs with their files", async () => {
    await createDataDir(db, "b");
    await createDataDir(db, "a");
    await putFile(db, "a", { path: "x.csv", size: 1, sha256: HASH });
    const dirs = await listDataDirs(db);
    expect(dirs.map((d) => [d.slug, d.files.length])).toEqual([
      ["a", 1],
      ["b", 0],
    ]);
  });
});

describe("files", () => {
  test("put replaces a file at the same path", async () => {
    await createDataDir(db, "wiki");
    await putFile(db, "wiki", { path: "a.csv", size: 1, sha256: HASH, contentType: "text/csv" });
    const dir = await putFile(db, "wiki", { path: "a.csv", size: 2, sha256: HASH2 });
    expect(dir.files).toEqual([
      expect.objectContaining({ path: "a.csv", size: 2, sha256: HASH2, contentType: null }),
    ]);
  });

  test("validates path, hash and size", async () => {
    await createDataDir(db, "wiki");
    await expectError(putFile(db, "wiki", { path: "../x", size: 1, sha256: HASH }), "invalid");
    await expectError(putFile(db, "wiki", { path: "README.md", size: 1, sha256: HASH }), "invalid");
    await expectError(putFile(db, "wiki", { path: "a", size: 1, sha256: "nope" }), "invalid");
    await expectError(putFile(db, "wiki", { path: "a", size: -1, sha256: HASH }), "invalid");
  });

  test("unknown data dir", async () => {
    await expectError(putFile(db, "missing", { path: "a", size: 1, sha256: HASH }), "not_found");
  });

  test("deleting a draft removes its files", async () => {
    await createDataDir(db, "wiki");
    await putFile(db, "wiki", { path: "a.csv", size: 1, sha256: HASH });
    await deleteDataDir(db, "wiki");
    expect(await getDataDir(db, "wiki")).toBeNull();
    const { results } = await db.prepare("SELECT * FROM data_dir_files").all();
    expect(results).toEqual([]);
  });
});

describe("publishing", () => {
  test("needs at least one data file", async () => {
    await createDataDir(db, "wiki");
    await expectError(markPublished(db, "wiki", RECORD), "empty");
  });

  test("records the record URI, CID and first publish time", async () => {
    const dir = await publishedWiki();
    expect(dir).toMatchObject({
      status: "published",
      recordUri: RECORD.uri,
      recordCid: RECORD.cid,
      publishedAt: RECORD.publishedAt,
    });
  });

  test("a record update keeps the first publish time", async () => {
    await publishedWiki();
    const dir = await markPublished(db, "wiki", {
      ...RECORD,
      cid: "bafyreinew",
      publishedAt: "2027-01-01T00:00:00.000Z",
    });
    expect(dir.recordCid).toBe("bafyreinew");
    expect(dir.publishedAt).toBe(RECORD.publishedAt);
  });

  test("files and license are fixed while published", async () => {
    await publishedWiki();
    await expectError(putFile(db, "wiki", { path: "b.csv", size: 1, sha256: HASH }), "published");
    await expectError(removeFile(db, "wiki", "a.parquet"), "published");
    await expectError(setLicense(db, "wiki", "MIT"), "published");
    await expectError(deleteDataDir(db, "wiki"), "published");
  });

  test("title, description and README stay editable while published", async () => {
    await publishedWiki();
    await updateMetadata(db, "wiki", { description: "New description" });
    const dir = await setReadme(db, "wiki", HASH2);
    expect(dir).toMatchObject({
      title: "Wiki",
      description: "New description",
      readmeSha256: HASH2,
    });
  });

  test("unpublishing returns it to an editable draft", async () => {
    await publishedWiki();
    const dir = await markUnpublished(db, "wiki");
    expect(dir).toMatchObject({
      status: "draft",
      recordUri: null,
      recordCid: null,
      publishedAt: null,
    });
    await setLicense(db, "wiki", "MIT");
  });
});
