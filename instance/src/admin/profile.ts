import { parquetMetadataAsync, parquetSchema } from "hyparquet";
import type { Column } from "@igloo/lexicon";

/**
 * Measuring what's in a data file: format from its name, and for Parquet the
 * row count and schema from its footer, read with two small range requests
 * (never the whole file). CSV and JSON are measured in the owner's browser
 * with DuckDB instead, since they have no footer to read.
 */

export type FileProfile = { format: string | null; rows?: number; schema?: Column[] };

const FORMATS: Record<string, string> = {
  parquet: "parquet",
  pq: "parquet",
  csv: "csv",
  tsv: "tsv",
  json: "json",
  jsonl: "jsonl",
  ndjson: "jsonl",
  arrow: "arrow",
  feather: "arrow",
};

/** The format a file name implies, looking through compression suffixes (data.csv.gz → csv). */
export function formatOf(path: string): string | null {
  const parts = path.toLowerCase().split("/").pop()!.split(".");
  while (parts.length > 1 && ["gz", "zst", "bz2", "xz"].includes(parts.at(-1)!)) parts.pop();
  return parts.length > 1 ? (FORMATS[parts.at(-1)!] ?? null) : null;
}

type Element = {
  name: string;
  type?: string;
  converted_type?: string;
  logical_type?: { type: string; [key: string]: unknown };
  precision?: number;
  scale?: number;
  num_children?: number;
};
type Node = { element: Element; children: Node[] };

/** A Parquet column's type, named the way DuckDB names it. */
export function duckdbType({ element, children }: Node): string {
  const logical = element.logical_type;
  const converted = element.converted_type;
  if (children.length > 0) {
    if (logical?.type === "LIST" || converted === "LIST") return "LIST";
    if (logical?.type === "MAP" || converted === "MAP" || converted === "MAP_KEY_VALUE")
      return "MAP";
    return "STRUCT";
  }
  switch (logical?.type) {
    case "STRING":
    case "ENUM":
      return "VARCHAR";
    case "JSON":
      return "JSON";
    case "UUID":
      return "UUID";
    case "DATE":
      return "DATE";
    case "TIME":
      return "TIME";
    case "TIMESTAMP":
      return "TIMESTAMP";
    case "DECIMAL":
      return `DECIMAL(${logical.precision ?? element.precision},${logical.scale ?? element.scale ?? 0})`;
    case "INTEGER": {
      const bits = Number(logical.bitWidth ?? 32);
      const signed = logical.isSigned !== false;
      const name = { 8: "TINYINT", 16: "SMALLINT", 32: "INTEGER", 64: "BIGINT" }[bits] ?? "BIGINT";
      return signed ? name : `U${name}`;
    }
    case "FLOAT16":
      return "FLOAT";
  }
  switch (converted) {
    case "UTF8":
    case "ENUM":
      return "VARCHAR";
    case "JSON":
      return "JSON";
    case "DATE":
      return "DATE";
    case "TIMESTAMP_MILLIS":
    case "TIMESTAMP_MICROS":
      return "TIMESTAMP";
    case "TIME_MILLIS":
    case "TIME_MICROS":
      return "TIME";
    case "DECIMAL":
      return `DECIMAL(${element.precision},${element.scale ?? 0})`;
    case "INT_8":
      return "TINYINT";
    case "INT_16":
      return "SMALLINT";
    case "INT_32":
      return "INTEGER";
    case "INT_64":
      return "BIGINT";
    case "UINT_8":
      return "UTINYINT";
    case "UINT_16":
      return "USMALLINT";
    case "UINT_32":
      return "UINTEGER";
    case "UINT_64":
      return "UBIGINT";
  }
  switch (element.type) {
    case "BOOLEAN":
      return "BOOLEAN";
    case "INT32":
      return "INTEGER";
    case "INT64":
      return "BIGINT";
    case "INT96":
      return "TIMESTAMP";
    case "FLOAT":
      return "FLOAT";
    case "DOUBLE":
      return "DOUBLE";
    case "BYTE_ARRAY":
    case "FIXED_LEN_BYTE_ARRAY":
      return "BLOB";
    default:
      return "UNKNOWN";
  }
}

/** Row count and top-level columns from a Parquet file's footer. */
export async function profileParquet(
  bucket: R2Bucket,
  key: string,
  size: number,
): Promise<FileProfile> {
  const buffer = {
    byteLength: size,
    async slice(start: number, end = size): Promise<ArrayBuffer> {
      const object = await bucket.get(key, { range: { offset: start, length: end - start } });
      if (!object) throw new Error(`${key} disappeared while reading it`);
      return object.arrayBuffer();
    },
  };
  const metadata = await parquetMetadataAsync(buffer);
  const root = parquetSchema(metadata) as unknown as Node;
  return {
    format: "parquet",
    rows: Number(metadata.num_rows),
    schema: root.children.map((child) => ({ name: child.element.name, type: duckdbType(child) })),
  };
}

/** Everything the server can measure about a file on its own. Never throws. */
export async function profileFile(
  bucket: R2Bucket,
  key: string,
  size: number,
): Promise<FileProfile> {
  const format = formatOf(key);
  if (format !== "parquet" || /\.(gz|zst|bz2|xz)$/i.test(key)) return { format };
  try {
    return await profileParquet(bucket, key, size);
  } catch (error) {
    console.warn(`Couldn't read the Parquet footer of ${key}`, error);
    return { format };
  }
}
