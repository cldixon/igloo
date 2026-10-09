import { Miniflare } from "miniflare";

/**
 * A fresh, in-memory D1 database backed by workerd, for tests. Call the
 * returned dispose() in afterEach/afterAll.
 */
export async function createTestD1(): Promise<{ db: D1Database; dispose: () => Promise<void> }> {
  const mf = new Miniflare({
    modules: true,
    script: "export default {}",
    d1Databases: ["DB"],
  });
  const db = (await mf.getD1Database("DB")) as unknown as D1Database;
  return { db, dispose: () => mf.dispose() };
}
