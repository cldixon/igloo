/** Files picked or dropped in the browser, with their paths inside the data dir. */
export type PickedFile = { path: string; file: File };

/**
 * Everything in a drop: files, and the contents of dropped folders. A single
 * dropped folder's own name is dropped from the paths, so dropping
 * "pageviews/" gives "data.parquet", not "pageviews/data.parquet".
 */
export async function droppedFiles(transfer: DataTransfer): Promise<PickedFile[]> {
  const entries = [...transfer.items]
    .map((item) => item.webkitGetAsEntry?.())
    .filter((e): e is FileSystemEntry => !!e);
  if (entries.length === 0) return [...transfer.files].map((file) => ({ path: file.name, file }));
  const files: PickedFile[] = [];
  const strip = entries.length === 1 && entries[0]!.isDirectory;
  for (const entry of entries) await walk(entry, strip ? "" : null, files);
  return files;
}

async function walk(entry: FileSystemEntry, prefix: string | null, out: PickedFile[]) {
  const here = prefix === null ? entry.name : prefix ? `${prefix}/${entry.name}` : "";
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject),
    );
    out.push({ path: here || entry.name, file });
    return;
  }
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    );
    if (batch.length === 0) break;
    for (const child of batch) await walk(child, here, out);
  }
}

/** Files from an <input type="file">, folder pickers included. */
export function pickedFiles(list: FileList): PickedFile[] {
  return [...list].map((file) => {
    const relative = file.webkitRelativePath;
    // A picked folder's paths start with the folder's own name; drop it.
    const path = relative ? relative.split("/").slice(1).join("/") : file.name;
    return { path: path || file.name, file };
  });
}

/** A best guess at a LICENSE file's SPDX identifier, from its text. */
export function guessLicense(text: string): string | null {
  const t = text.slice(0, 4000).toLowerCase();
  const rules: [RegExp, string][] = [
    [/attribution-sharealike 4\.0|cc by-sa 4\.0/, "CC-BY-SA-4.0"],
    [/attribution-noncommercial 4\.0|cc by-nc 4\.0/, "CC-BY-NC-4.0"],
    [/attribution 4\.0 international|cc by 4\.0/, "CC-BY-4.0"],
    [/cc0|public domain dedication/, "CC0-1.0"],
    [/open database license|odbl/, "ODbL-1.0"],
    [/public domain dedication and license|pddl/, "PDDL-1.0"],
    [/apache license,? version 2\.0/, "Apache-2.0"],
    [/\bmit license\b|permission is hereby granted, free of charge/, "MIT"],
  ];
  return rules.find(([re]) => re.test(t))?.[1] ?? null;
}
