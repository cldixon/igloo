import { Miniflare } from "miniflare";

/**
 * Real D1 and R2 bindings backed by workerd, in memory, for tests. Call the
 * returned dispose() in afterEach/afterAll.
 */
export async function createTestBindings(): Promise<{
  db: D1Database;
  bucket: R2Bucket;
  dispose: () => Promise<void>;
}> {
  const mf = new Miniflare({
    modules: true,
    script: "export default {}",
    d1Databases: ["DB"],
    r2Buckets: ["DATA"],
  });
  const db = (await mf.getD1Database("DB")) as unknown as D1Database;
  const bucket = (await mf.getR2Bucket("DATA")) as unknown as R2Bucket;
  return { db, bucket, dispose: () => mf.dispose() };
}

/** Just a D1 database; see createTestBindings. */
export async function createTestD1(): Promise<{ db: D1Database; dispose: () => Promise<void> }> {
  const { db, dispose } = await createTestBindings();
  return { db, dispose };
}
