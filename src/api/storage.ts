/// <reference types="@cloudflare/workers-types" />

import type { DirectoryEntry, FileMetadata } from "../shared/types.js";

/**
 * List a single directory level. R2 pages at 1000 keys, so walk the cursor —
 * a dataset prefix can easily exceed one page.
 */
export async function listObjects(bucket: R2Bucket, prefix: string): Promise<DirectoryEntry[]> {
  const directories: DirectoryEntry[] = [];
  const files: DirectoryEntry[] = [];
  let cursor: string | undefined;

  for (;;) {
    const page = await bucket.list({
      prefix: prefix || undefined,
      delimiter: "/",
      cursor,
    });

    for (const fullPath of page.delimitedPrefixes) {
      directories.push({
        name: fullPath.slice(prefix.length).replace(/\/$/, ""),
        path: fullPath,
        type: "directory",
      });
    }

    for (const obj of page.objects) {
      // Skip the zero-byte marker some tools write for the directory itself.
      if (obj.key === prefix) continue;
      const name = obj.key.slice(prefix.length);
      files.push({
        name,
        path: obj.key,
        type: "file",
        size: obj.size,
        lastModified: obj.uploaded.toISOString(),
        extension: name.includes(".") ? name.split(".").pop() : undefined,
      });
    }

    if (!page.truncated) break;
    cursor = page.cursor;
  }

  return [...directories, ...files];
}

export async function getReadme(bucket: R2Bucket, prefix: string): Promise<string | null> {
  const object = await bucket.get(`${prefix}README.md`);
  return object ? await object.text() : null;
}

export function getObject(bucket: R2Bucket, key: string): Promise<R2ObjectBody | null> {
  return bucket.get(key);
}

export async function getObjectMetadata(
  bucket: R2Bucket,
  key: string,
): Promise<FileMetadata | null> {
  const object = await bucket.head(key);
  if (!object) return null;

  return {
    name: key.split("/").pop() ?? key,
    path: key,
    size: object.size,
    lastModified: object.uploaded.toISOString(),
    contentType: object.httpMetadata?.contentType ?? "application/octet-stream",
    etag: object.httpEtag,
  };
}
