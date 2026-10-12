/**
 * The public API of @igloo/query, declared without DOM types so Worker code
 * (which has none) can import it: @igloo/ui's query panel is server-rendered
 * inside the AppView Worker. The implementation is src/index.ts.
 */
export declare const DUCKDB_VERSION: string;
export type DuckDBSource = { module: string; dist: string };
export declare const DUCKDB_CDN: DuckDBSource;
export type QueryFile = { name: string; url: string; format: string };
export type DuckDB = { query(sql: string): Promise<{ columns: string[]; rows: unknown[][] }> };
export declare function loadDuckDB(source: DuckDBSource): Promise<DuckDB>;
export declare function measureFile(
  db: DuckDB,
  url: string,
  format: string,
): Promise<{ rows: number; schema: { name: string; type: string }[] }>;
export declare function mountQueryPanel(
  root: unknown,
  options: { files: QueryFile[]; duckdb: DuckDBSource; maxRows?: number },
  load: (source: DuckDBSource) => Promise<DuckDB>,
): void;
export declare const QUERY_PANEL_CSS: string;
export declare function guessFormat(path: string): string | null;
export declare function tableNames(paths: string[]): Map<string, string>;
export declare function queryFiles(
  files: { path: string; format?: string | null }[],
  downloadUrl: (path: string) => string,
): QueryFile[];
