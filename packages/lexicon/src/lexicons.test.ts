import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "fs";
import { NSID } from "./nsid.ts";
import { column, dataDirRecord, dataFile, instanceRecord, readmeRef } from "./records.ts";

/**
 * The Lexicon JSON (what gets published at the reset point) and the zod
 * schemas (what the code validates with) must describe the same records.
 */
const dir = new URL("../lexicons/", import.meta.url);
const docs = Object.fromEntries(
  readdirSync(dir).map((f) => [
    f.replace(/\.json$/, ""),
    JSON.parse(readFileSync(new URL(f, dir), "utf8")),
  ]),
);

function fields(schema: {
  shape: Record<string, { safeParse(v: unknown): { success: boolean } }>;
}) {
  const keys = Object.keys(schema.shape).filter((k) => k !== "$type");
  const required = keys.filter((k) => !schema.shape[k]!.safeParse(undefined).success);
  return { keys: keys.sort(), required: required.sort() };
}

function lexFields(def: { properties: Record<string, unknown>; required?: string[] }) {
  return { keys: Object.keys(def.properties).sort(), required: [...(def.required ?? [])].sort() };
}

describe("lexicon JSON", () => {
  test("there is one document per NSID, with matching ids", () => {
    expect(Object.keys(docs).sort()).toEqual(Object.values(NSID).sort());
    for (const [id, doc] of Object.entries(docs)) expect(doc.id).toBe(id);
  });

  test("dataDir matches the zod schema", () => {
    const defs = docs[NSID.dataDir].defs;
    expect(lexFields(defs.main.record)).toEqual(fields(dataDirRecord as never));
    expect(lexFields(defs.file)).toEqual(fields(dataFile as never));
    expect(lexFields(defs.column)).toEqual(fields(column as never));
    expect(lexFields(defs.readme)).toEqual(fields(readmeRef as never));
  });

  test("instance matches the zod schema", () => {
    expect(lexFields(docs[NSID.instance].defs.main.record)).toEqual(
      fields(instanceRecord as never),
    );
  });

  test("notifyRecord takes an AT URI", () => {
    const main = docs[NSID.notifyRecord].defs.main;
    expect(main.type).toBe("procedure");
    expect(main.input.schema.required).toEqual(["uri"]);
  });
});
