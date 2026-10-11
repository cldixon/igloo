import type { DataDir } from "../shared/types.js";

/**
 * AI drafts for a data dir's prose: a README (with a column table), a short
 * description and tags. The facts (file names, sizes, row counts, column
 * types) are measured; the model only writes words around them, and the owner
 * reviews everything before saving. Nothing here is saved automatically.
 */

export const DRAFT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export type Draft = {
  description: string;
  tags: string[];
  readme: string;
};

type AiBinding = { run(model: string, input: unknown): Promise<unknown> };

/** What the model is told: only measured facts, and what the owner has written. */
export function draftPrompt(dir: DataDir, readme: string | null): string {
  const files = dir.files.map((f) => ({
    path: f.path,
    bytes: f.size,
    format: f.format,
    rows: f.rows,
    columns: f.schema,
  }));
  return [
    "You are helping someone publish a dataset. Draft documentation for it from the facts below.",
    "Only state what the facts support. Where something isn't known (where the data came from,",
    "how it was collected), write a short TODO for the owner instead of guessing.",
    "",
    `Data dir name: ${dir.slug}`,
    dir.title ? `Title: ${dir.title}` : "",
    dir.description ? `Owner's description: ${dir.description}` : "",
    dir.license ? `License: ${dir.license}` : "",
    readme ? `Current README:\n${readme.slice(0, 4000)}` : "",
    `Files (measured): ${JSON.stringify(files)}`,
    "",
    "Reply with JSON only, no other text, in this shape:",
    '{"description": "one or two plain sentences",',
    ' "tags": ["2 to 6 lowercase tags, words joined with dashes"],',
    ' "readme": "markdown: a title, an overview, a Files section, a table of each file\'s',
    "   columns with name, type and a short description of what the column likely holds",
    '   (say \\"likely\\" where you are inferring from the name), and a Usage section with a',
    '   DuckDB SQL example"}',
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/** Pull the JSON object out of a model reply, tolerating code fences and chatter. */
export function parseDraft(reply: string): Draft {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The model didn't return a draft");
  const raw = JSON.parse(reply.slice(start, end + 1)) as Partial<Record<keyof Draft, unknown>>;
  const tags = Array.isArray(raw.tags)
    ? raw.tags
        .map((t) =>
          String(t)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, ""),
        )
        .filter((t) => t.length > 0 && t.length <= 40)
        .slice(0, 6)
    : [];
  return {
    description: typeof raw.description === "string" ? raw.description.trim().slice(0, 3000) : "",
    tags: [...new Set(tags)],
    readme: typeof raw.readme === "string" ? raw.readme.trim() : "",
  };
}

export async function draftDocs(
  ai: AiBinding,
  dir: DataDir,
  readme: string | null,
): Promise<Draft> {
  const result = (await ai.run(DRAFT_MODEL, {
    messages: [{ role: "user", content: draftPrompt(dir, readme) }],
    max_tokens: 2048,
    temperature: 0.2,
  })) as { response?: unknown };
  const reply =
    typeof result.response === "string" ? result.response : JSON.stringify(result.response ?? "");
  return parseDraft(reply);
}
