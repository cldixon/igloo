/**
 * In-browser SQL over a data dir's files, with DuckDB-WASM.
 *
 * Public Parquet supports HTTP range requests, so DuckDB reads only the
 * columns and row groups a query needs, straight from the instance: no igloo
 * server does any compute. The same panel runs on the AppView (inlined into
 * its server-rendered page, which is why each exported function here is
 * self-contained: no imports, no references to module scope) and in the
 * instance's own UI (imported normally).
 */

/** DuckDB-WASM, pinned. */
export const DUCKDB_VERSION = "1.32.0";

/**
 * Where to load DuckDB-WASM from: its ES module (with dependencies resolved,
 * which jsDelivr's +esm endpoint does) and the directory holding its wasm
 * and worker files.
 */
export type DuckDBSource = { module: string; dist: string };

export const DUCKDB_CDN: DuckDBSource = {
  module: `https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${DUCKDB_VERSION}/+esm`,
  dist: `https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${DUCKDB_VERSION}/dist/`,
};

export type QueryFile = {
  /** The table name to query it by. */
  name: string;
  /** Absolute URL that serves the file with range requests. */
  url: string;
  /** parquet, csv, tsv, json or jsonl. Other formats aren't queryable. */
  format: string;
};

/** The minimal DuckDB-WASM surface used here. */
export type DuckDB = {
  query(sql: string): Promise<{ columns: string[]; rows: unknown[][] }>;
};

/**
 * Start DuckDB-WASM in a worker. Self-contained so it can be inlined with
 * Function.prototype.toString().
 */
export async function loadDuckDB(source: DuckDBSource): Promise<DuckDB> {
  const duckdb = await import(/* @vite-ignore */ source.module);
  const base = source.dist;
  const bundle = await duckdb.selectBundle({
    mvp: {
      mainModule: `${base}duckdb-mvp.wasm`,
      mainWorker: `${base}duckdb-browser-mvp.worker.js`,
    },
    eh: { mainModule: `${base}duckdb-eh.wasm`, mainWorker: `${base}duckdb-browser-eh.worker.js` },
  });
  // Workers can't load cross-origin scripts directly; a same-origin blob can import it.
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], { type: "text/javascript" }),
  );
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), new Worker(workerUrl));
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);
  const conn = await db.connect();
  return {
    async query(sql: string) {
      const table = await conn.query(sql);
      const columns: string[] = table.schema.fields.map((f: { name: string }) => f.name);
      const rows = table.toArray().map((row: { toJSON(): Record<string, unknown> }) => {
        const obj = row.toJSON();
        return columns.map((c) => obj[c]);
      });
      return { columns, rows };
    },
  };
}

/**
 * Measure a file: its row count and its columns' DuckDB types. Facts, not
 * guesses: this is what goes into the record's schema. Self-contained.
 */
export async function measureFile(
  db: DuckDB,
  url: string,
  format: string,
): Promise<{ rows: number; schema: { name: string; type: string }[] }> {
  const quoted = `'${url.replace(/'/g, "''")}'`;
  const reader =
    format === "parquet"
      ? `read_parquet(${quoted})`
      : format === "csv"
        ? `read_csv_auto(${quoted})`
        : format === "tsv"
          ? `read_csv_auto(${quoted}, delim='\\t')`
          : format === "json" || format === "jsonl"
            ? `read_json_auto(${quoted})`
            : null;
  if (!reader) throw new Error(`Can't measure ${format} files`);
  const described = await db.query(`DESCRIBE SELECT * FROM ${reader}`);
  const nameAt = described.columns.indexOf("column_name");
  const typeAt = described.columns.indexOf("column_type");
  const counted = await db.query(`SELECT count(*) AS n FROM ${reader}`);
  return {
    rows: Number(counted.rows[0]?.[0] ?? 0),
    schema: described.rows.map((r) => ({ name: String(r[nameAt]), type: String(r[typeAt]) })),
  };
}

/**
 * A SQL panel over `files`: each queryable file becomes a view named after it.
 * Renders into `root`. Self-contained; `load` is loadDuckDB (passed in so the
 * panel can be inlined separately).
 */
export function mountQueryPanel(
  root: HTMLElement,
  options: { files: QueryFile[]; duckdb: DuckDBSource; maxRows?: number },
  load: (source: DuckDBSource) => Promise<DuckDB>,
): void {
  const maxRows = options.maxRows ?? 500;
  const queryable = options.files.filter((f) =>
    ["parquet", "csv", "tsv", "json", "jsonl"].includes(f.format),
  );
  const el = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs: Record<string, string> = {},
    text = "",
  ) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text) node.textContent = text;
    return node;
  };
  const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;

  root.replaceChildren();
  root.classList.add("igloo-query");
  if (queryable.length === 0) {
    root.append(el("p", { class: "igloo-query-note" }, "No Parquet, CSV or JSON files to query."));
    return;
  }

  const textarea = el("textarea", { spellcheck: "false", rows: "4", "aria-label": "SQL query" });
  textarea.value = `SELECT * FROM ${ident(queryable[0]!.name)} LIMIT 100;`;
  const run = el("button", { type: "button" }, "Run query");
  const status = el("span", { class: "igloo-query-status" });
  const tables = el(
    "p",
    { class: "igloo-query-note" },
    `Tables: ${queryable.map((f) => ident(f.name)).join(", ")}. Runs in your browser with DuckDB; Parquet is read with range requests.`,
  );
  const output = el("div", { class: "igloo-query-output" });
  const bar = el("div", { class: "igloo-query-bar" });
  bar.append(run, status);
  root.append(tables, textarea, bar, output);

  let ready: Promise<DuckDB> | null = null;
  const failed: string[] = [];
  const start = () => {
    ready ??= (async () => {
      const db = await load(options.duckdb);
      for (const f of queryable) {
        const quoted = `'${f.url.replace(/'/g, "''")}'`;
        const reader =
          f.format === "parquet"
            ? `read_parquet(${quoted})`
            : f.format === "csv"
              ? `read_csv_auto(${quoted})`
              : f.format === "tsv"
                ? `read_csv_auto(${quoted}, delim='\\t')`
                : `read_json_auto(${quoted})`;
        // One unreadable file shouldn't take the others down with it.
        try {
          await db.query(`CREATE OR REPLACE VIEW ${ident(f.name)} AS SELECT * FROM ${reader}`);
        } catch (error) {
          failed.push(
            `${ident(f.name)} (${error instanceof Error ? error.message : String(error)})`,
          );
        }
      }
      if (failed.length > 0) {
        tables.textContent = `${tables.textContent} Couldn't load: ${failed.join("; ")}.`;
      }
      return db;
    })();
    ready.catch(() => (ready = null));
    return ready;
  };

  const render = (columns: string[], rows: unknown[][]) => {
    const table = el("table");
    const head = el("tr");
    for (const c of columns) head.append(el("th", {}, c));
    table.append(el("thead"), el("tbody"));
    table.tHead!.append(head);
    for (const row of rows.slice(0, maxRows)) {
      const tr = el("tr");
      for (const v of row) {
        const text =
          v === null || v === undefined
            ? "NULL"
            : typeof v === "bigint"
              ? v.toString()
              : v instanceof Date
                ? v.toISOString()
                : typeof v === "object"
                  ? JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))
                  : String(v);
        tr.append(el("td", v === null || v === undefined ? { class: "null" } : {}, text));
      }
      table.tBodies[0]!.append(tr);
    }
    output.replaceChildren(table);
  };

  run.addEventListener("click", async () => {
    run.setAttribute("disabled", "");
    status.textContent = ready ? "Running…" : "Loading DuckDB…";
    status.className = "igloo-query-status";
    const began = performance.now();
    try {
      const db = await start();
      status.textContent = "Running…";
      const { columns, rows } = await db.query(textarea.value);
      render(columns, rows);
      const ms = Math.round(performance.now() - began);
      status.textContent = `${rows.length} row${rows.length === 1 ? "" : "s"} in ${ms} ms${rows.length > maxRows ? ` (showing ${maxRows})` : ""}`;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error);
      status.className = "igloo-query-status error";
    } finally {
      run.removeAttribute("disabled");
    }
  });
}

/** Default styles for the panel; hosts can override with their own variables. */
export const QUERY_PANEL_CSS = `
.igloo-query { display: grid; gap: 8px; min-width: 0; }
.igloo-query textarea { font: 0.82rem/1.5 var(--mono, ui-monospace, monospace); width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--line, #ccc); background: var(--sunken, #f6f8fa); color: inherit; resize: vertical; }
.igloo-query-bar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.igloo-query-bar button { font: inherit; font-size: 0.85rem; padding: 4px 14px; border-radius: 6px; border: 1px solid var(--line, #ccc); background: var(--surface, #fff); color: inherit; cursor: pointer; }
.igloo-query-status { font: 0.8rem var(--mono, ui-monospace, monospace); color: var(--muted, #666); }
.igloo-query-status.error { color: #c0392b; }
.igloo-query-note { margin: 0; font-size: 0.85rem; color: var(--muted, #666); }
.igloo-query-output { overflow: auto; max-height: 28rem; }
.igloo-query-output table { border-collapse: collapse; font: 0.78rem var(--mono, ui-monospace, monospace); }
.igloo-query-output th, .igloo-query-output td { text-align: left; padding: 3px 10px 3px 0; white-space: nowrap; border-bottom: 1px solid var(--line, #ddd); }
.igloo-query-output td.null { color: var(--muted, #999); }
`;

/** The format a file name implies, looking through compression suffixes (data.csv.gz → csv). */
export function guessFormat(path: string): string | null {
  const formats: Record<string, string> = {
    parquet: "parquet",
    pq: "parquet",
    csv: "csv",
    tsv: "tsv",
    json: "json",
    jsonl: "jsonl",
    ndjson: "jsonl",
    arrow: "arrow",
  };
  const parts = path.toLowerCase().split("/").pop()!.split(".");
  while (parts.length > 1 && ["gz", "zst", "bz2", "xz"].includes(parts.at(-1)!)) parts.pop();
  return parts.length > 1 ? (formats[parts.at(-1)!] ?? null) : null;
}

/**
 * Table names for a data dir's files: the file name without extensions
 * (flows.parquet → flows), or the full path where two files would collide.
 */
export function tableNames(paths: string[]): Map<string, string> {
  const base = (p: string) => p.split("/").pop()!.split(".")[0] || p;
  const counts = new Map<string, number>();
  for (const p of paths) counts.set(base(p), (counts.get(base(p)) ?? 0) + 1);
  return new Map(paths.map((p) => [p, counts.get(base(p))! > 1 ? p : base(p)]));
}

/** The query panel's files for a data dir served by `downloadUrl`. */
export function queryFiles(
  files: { path: string; format?: string | null }[],
  downloadUrl: (path: string) => string,
): QueryFile[] {
  const names = tableNames(files.map((f) => f.path));
  return files.flatMap((f) => {
    const format = f.format ?? guessFormat(f.path);
    return format ? [{ name: names.get(f.path)!, url: downloadUrl(f.path), format }] : [];
  });
}
