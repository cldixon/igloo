/** Hashing and naming data files in R2. */

export type HashedObject = { size: number; sha256: string; contentType: string | null };

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * sha256 an R2 object by streaming it. Workers' DigestStream hashes natively
 * without buffering, so multi-GB files are fine; elsewhere (tests) it falls
 * back to hashing the whole body.
 */
export async function hashObject(bucket: R2Bucket, key: string): Promise<HashedObject | null> {
  const object = await bucket.get(key);
  if (!object) return null;
  let digest: ArrayBuffer;
  const DigestStream = (
    crypto as {
      DigestStream?: new (alg: string) => WritableStream & { digest: Promise<ArrayBuffer> };
    }
  ).DigestStream;
  if (DigestStream) {
    const stream = new DigestStream("SHA-256");
    await object.body.pipeTo(stream);
    digest = await stream.digest;
  } else {
    digest = await crypto.subtle.digest("SHA-256", await object.arrayBuffer());
  }
  return {
    size: object.size,
    sha256: hex(digest),
    contentType: object.httpMetadata?.contentType ?? null,
  };
}

export async function sha256Text(text: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

/** A data dir file's R2 key. */
export function objectKey(slug: string, path: string): string {
  return `${slug}/${path}`;
}

const CONTENT_TYPES: Record<string, string> = {
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
  jsonl: "application/jsonl",
  ndjson: "application/x-ndjson",
  parquet: "application/vnd.apache.parquet",
  arrow: "application/vnd.apache.arrow.file",
  gz: "application/gzip",
  zip: "application/zip",
  zst: "application/zstd",
};

/** The type to store a file under: what the uploader sent, unless that says nothing. */
export function contentTypeFor(path: string, sent: string | null | undefined): string {
  if (sent && sent !== "application/octet-stream") return sent;
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/**
 * A request body R2 will accept: R2 needs to know the length up front, so the
 * stream goes through a FixedLengthStream sized from Content-Length (which
 * also rejects a body that doesn't match it). Outside Workers (tests), the
 * body is buffered instead.
 */
export function sizedBody(request: Request, length: number): ReadableStream | Promise<ArrayBuffer> {
  const Fixed = (globalThis as { FixedLengthStream?: new (n: number) => TransformStream })
    .FixedLengthStream;
  if (!Fixed || !request.body) return request.arrayBuffer();
  const { readable, writable } = new Fixed(length);
  void request.body.pipeTo(writable).catch(() => {});
  return readable;
}
