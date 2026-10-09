import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createTestD1 } from "../test/d1.js";
import { MIGRATIONS } from "./migrations.js";
import { migrate } from "./migrate.js";

let db: D1Database;
let dispose: () => Promise<void>;

beforeEach(async () => ({ db, dispose } = await createTestD1()));
afterEach(() => dispose());

async function tables(): Promise<string[]> {
  const { results } = await db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_cf%' ESCAPE '\\' ORDER BY name",
    )
    .all<{ name: string }>();
  return results.map((r) => r.name).filter((n) => !n.startsWith("sqlite_"));
}

describe("migrate", () => {
  test("applies every migration to a fresh database", async () => {
    expect(await migrate(db)).toEqual(MIGRATIONS.map((m) => m.name));
    expect(await tables()).toEqual(["_migrations", "data_dir_files", "data_dirs", "settings"]);
  });

  test("is a no-op once up to date", async () => {
    await migrate(db);
    expect(await migrate(db)).toEqual([]);
  });

  test("applies only what is pending", async () => {
    await migrate(db);
    const next = { name: "9999_extra", statements: ["CREATE TABLE extra (id INTEGER)"] };
    expect(await migrate(db, [...MIGRATIONS, next])).toEqual(["9999_extra"]);
    expect(await tables()).toContain("extra");
  });

  test("a failing migration rolls back entirely and is not recorded", async () => {
    const bad = {
      name: "0002_bad",
      statements: ["CREATE TABLE half (id INTEGER)", "THIS IS NOT SQL"],
    };
    await expect(migrate(db, [...MIGRATIONS, bad])).rejects.toThrow();
    expect(await tables()).not.toContain("half");
    // The good migration before it stays applied, and the bad one can be retried once fixed.
    const fixed = { ...bad, statements: ["CREATE TABLE half (id INTEGER)"] };
    expect(await migrate(db, [...MIGRATIONS, fixed])).toEqual(["0002_bad"]);
  });

  test("concurrent runs apply each migration exactly once", async () => {
    const runs = await Promise.all([migrate(db), migrate(db), migrate(db)]);
    expect(runs.flat().sort()).toEqual(MIGRATIONS.map((m) => m.name).sort());
    const { results } = await db.prepare("SELECT name FROM _migrations").all();
    expect(results).toHaveLength(MIGRATIONS.length);
  });
});
