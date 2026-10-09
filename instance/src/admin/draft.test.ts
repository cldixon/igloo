import { describe, expect, test } from "bun:test";
import type { DataDir } from "../shared/types.js";
import { draftDocs, draftPrompt, parseDraft } from "./draft.js";

const dir: DataDir = {
  slug: "usbr-flows",
  title: "USBR flows",
  description: null,
  license: "CC0-1.0",
  readmeSha256: null,
  tags: [],
  status: "draft",
  recordUri: null,
  recordCid: null,
  publishedAt: null,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  files: [
    {
      path: "flows.parquet",
      size: 23383,
      sha256: "a".repeat(64),
      contentType: null,
      uploadedAt: "2026-10-01T00:00:00Z",
      format: "parquet",
      rows: 5000,
      schema: [
        { name: "station", type: "VARCHAR" },
        { name: "flow", type: "DOUBLE" },
      ],
    },
  ],
};

describe("draftPrompt", () => {
  test("gives the model the measured facts", () => {
    const prompt = draftPrompt(dir, null);
    expect(prompt).toContain("usbr-flows");
    expect(prompt).toContain('"rows":5000');
    expect(prompt).toContain('{"name":"flow","type":"DOUBLE"}');
    expect(prompt).toContain("CC0-1.0");
    expect(prompt).not.toContain("Current README");
  });
});

describe("parseDraft", () => {
  test("reads JSON inside a code fence with chatter around it", () => {
    const reply =
      'Sure!\n```json\n{"description":"Daily flows.","tags":["Hydrology","time series","hydrology"],"readme":"# USBR"}\n```\nHope that helps.';
    expect(parseDraft(reply)).toEqual({
      description: "Daily flows.",
      tags: ["hydrology", "time-series"],
      readme: "# USBR",
    });
  });

  test("missing fields come back empty; garbage is an error", () => {
    expect(parseDraft('{"readme":"x"}')).toEqual({ description: "", tags: [], readme: "x" });
    expect(() => parseDraft("no json here")).toThrow();
  });
});

test("draftDocs calls Workers AI and parses its response", async () => {
  let seen: any;
  const ai = {
    run: async (model: string, input: unknown) => {
      seen = { model, input };
      return { response: '{"description":"d","tags":["a"],"readme":"# r"}' };
    },
  };
  expect(await draftDocs(ai, dir, "# old readme")).toEqual({
    description: "d",
    tags: ["a"],
    readme: "# r",
  });
  expect(seen.model).toStartWith("@cf/");
  expect(seen.input.messages[0].content).toContain("# old readme");
});
