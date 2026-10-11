import { NSID, validateDataDir, type DataDirRecord, type ValidationResult } from "@igloo/lexicon";
import { README_PATH, type DataDir } from "./db/dataDirs.js";

/**
 * The dataDir record for a data dir, validated against the lexicon before it
 * goes anywhere near the owner's PDS.
 *
 * `createdAt` is the first publish time: kept from an earlier publish when
 * there is one (so a metadata edit doesn't move the data dir in the feed),
 * otherwise `publishTime`.
 */
export function buildDataDirRecord(
  dir: DataDir,
  instanceUrl: string,
  publishTime: string = new Date().toISOString(),
): ValidationResult<DataDirRecord> {
  return validateDataDir({
    $type: NSID.dataDir,
    name: dir.slug,
    instance: instanceUrl,
    files: dir.files.map(({ path, size, sha256, format, rows, schema }) => ({
      path,
      size,
      sha256,
      ...(format && { format }),
      ...(rows != null && { rows }),
      ...(schema && schema.length > 0 && { schema }),
    })),
    createdAt: dir.publishedAt ?? publishTime,
    ...(dir.title && { title: dir.title }),
    ...(dir.description && { description: dir.description }),
    ...(dir.license && { license: dir.license }),
    ...(dir.readmeSha256 && { readme: { path: README_PATH, sha256: dir.readmeSha256 } }),
    ...(dir.tags.length > 0 && { tags: dir.tags }),
  });
}
