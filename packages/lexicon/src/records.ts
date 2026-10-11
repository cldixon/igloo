/**
 * Record schemas for the phase 1 lexicon.
 *
 * Parsing ignores unknown fields: lexicons grow by adding optional fields, so
 * a record written by a newer igloo must still validate here. Records
 * describe data and point to it; they never carry the data, and never secrets.
 */
import { z } from "zod";
import { NSID } from "./nsid.ts";
import { SLUG_PATTERN, parseAtUri } from "./uri.ts";

const datetime = z.iso.datetime({ offset: true });

/** Hex-encoded sha256, lowercase. */
export const sha256Hex = z.string().regex(/^[0-9a-f]{64}$/, "expected a lowercase hex sha256");

/**
 * A file path relative to the data dir: `/`-separated, no empty, `.` or `..`
 * segments, no leading slash, backslashes or control characters.
 */
export const relativePath = z
  .string()
  .min(1)
  .max(1024)
  .refine(
    (p) =>
      !/[\\\u0000-\u001f\u007f]/.test(p) &&
      p.split("/").every((seg) => seg !== "" && seg !== "." && seg !== ".."),
    "expected a relative path inside the data dir",
  );

/**
 * The public URL of an instance. https only, except http on localhost so a
 * local `cf dev` instance can publish during development.
 */
export const instanceUrl = z.url().refine((value) => {
  const url = new URL(value);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const bare = url.pathname === "/" && !url.search && !url.hash && !url.username;
  return bare && (url.protocol === "https:" || (local && url.protocol === "http:"));
}, "expected an https origin with no path");

/** File formats igloo knows how to describe and query. Others are just files. */
export const FILE_FORMATS = ["parquet", "csv", "tsv", "json", "jsonl", "arrow"] as const;

/** One column, as measured (never guessed): its name and DuckDB type, e.g. BIGINT. */
export const column = z.object({
  name: z.string().min(1).max(256),
  type: z.string().min(1).max(128),
});

export const dataFile = z.object({
  path: relativePath,
  /** Bytes. */
  size: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  sha256: sha256Hex,
  // Phase 2, all optional: what's in the file, measured from the file itself.
  format: z.string().min(1).max(32).optional(),
  rows: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  schema: z.array(column).max(2000).optional(),
});

/** A tag: lowercase words joined by dashes, e.g. time-series. */
export const tag = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "expected a lowercase tag")
  .max(40);

export const readmeRef = z.object({
  path: relativePath,
  sha256: sha256Hex,
});

/** `dev.cldixon.igloo.dataDir`, rkey = `name`. */
export const dataDirRecord = z
  .object({
    $type: z.literal(NSID.dataDir),
    name: z.string().regex(SLUG_PATTERN, "expected a data dir slug"),
    instance: instanceUrl,
    files: z.array(dataFile).min(1).max(1000),
    createdAt: datetime,
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(3000).optional(),
    /** SPDX identifier where one exists, e.g. CC-BY-4.0. */
    license: z.string().min(1).max(100).optional(),
    readme: readmeRef.optional(),
    tags: z.array(tag).max(20).optional(),
  })
  .superRefine((record, ctx) => {
    const paths = new Set<string>();
    record.files.forEach((file, i) => {
      if (paths.has(file.path)) {
        ctx.addIssue({ code: "custom", path: ["files", i, "path"], message: "duplicate path" });
      }
      paths.add(file.path);
    });
    if (record.readme && paths.has(record.readme.path)) {
      ctx.addIssue({
        code: "custom",
        path: ["readme", "path"],
        message: "the README is hashed separately and must not be listed in files",
      });
    }
  });

/** `dev.cldixon.igloo.instance`, rkey = the instance's host (see instanceRkey). */
export const instanceRecord = z.object({
  $type: z.literal(NSID.instance),
  url: instanceUrl,
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  createdAt: datetime,
});

/** Input to the `dev.cldixon.igloo.notifyRecord` XRPC procedure. */
export const notifyRecordInput = z.object({
  uri: z.string().refine((uri) => {
    const parsed = parseAtUri(uri);
    return (
      parsed !== null && (parsed.collection === NSID.dataDir || parsed.collection === NSID.instance)
    );
  }, "expected the AT URI of an igloo record"),
});

export type DataFile = z.infer<typeof dataFile>;
export type Column = z.infer<typeof column>;
export type DataDirRecord = z.infer<typeof dataDirRecord>;
export type InstanceRecord = z.infer<typeof instanceRecord>;
export type NotifyRecordInput = z.infer<typeof notifyRecordInput>;

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

function validate<T>(schema: z.ZodType<T>, input: unknown): ValidationResult<T> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((i) => `${i.path.join(".") || "(record)"}: ${i.message}`),
  };
}

export function validateDataDir(input: unknown): ValidationResult<DataDirRecord> {
  return validate(dataDirRecord, input);
}

export function validateInstance(input: unknown): ValidationResult<InstanceRecord> {
  return validate(instanceRecord, input);
}

export function validateNotifyRecordInput(input: unknown): ValidationResult<NotifyRecordInput> {
  return validate(notifyRecordInput, input);
}
