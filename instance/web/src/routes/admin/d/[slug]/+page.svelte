<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import type { DataDir } from "@igloo/shared";
  import {
    Button,
    CopyButton,
    Dialog,
    Field,
    FileTable,
    Loading,
    MetaList,
    Notice,
    Section,
    StatusMark,
    Stepper,
    TabNav,
    formatBytes,
    hostOf,
    plural,
    shortHash,
  } from "@igloo/ui";
  import { DUCKDB_CDN, guessFormat, loadDuckDB, measureFile } from "@igloo/query";
  import { admin, feedUrl, LICENSES, uploadFile, type DataDirDetail } from "$lib/admin";
  import { guessLicense, type PickedFile } from "$lib/files";
  import DropZone from "$lib/components/DropZone.svelte";

  let { data } = $props();

  const slug = page.params.slug as string;
  const README = "README.md";
  const MEASURABLE = ["csv", "tsv", "json", "jsonl"];

  let detail = $state<DataDirDetail | null>(null);
  let loadError = $state<string | null>(null);
  let error = $state<string | null>(null);
  let notice = $state<string | null>(null);
  let busy = $state(false);
  let justPublished = $state(false);
  let confirmUnpublish = $state(false);
  let confirmRemove = $state(false);

  // Details form
  let title = $state("");
  let description = $state("");
  let license = $state("");
  let customLicense = $state("");
  let tags = $state("");
  let readme = $state("");

  // Uploads in progress
  type Upload = { path: string; size: number; progress: number; sha256?: string; error?: string };
  let uploads = $state<Upload[]>([]);
  let subfolder = $state("");

  let dir = $derived(detail?.dataDir);
  let published = $derived(dir?.status === "published");
  let step = $derived(page.url.searchParams.get("step") ?? (published ? "details" : "files"));
  let total = $derived(dir?.files.reduce((s, f) => s + f.size, 0) ?? 0);
  let licenseValue = $derived(license === "other" ? customLicense.trim() : license);
  let recordUri = $derived(
    dir?.recordUri ??
      `at://${data.config.ownerDid ?? "did:…"}/${data.config.dataDirCollection ?? "…"}/${slug}`,
  );
  let onFeed = $derived(
    dir?.recordUri && data.config.appview ? feedUrl(data.config.appview, dir.recordUri) : null,
  );
  let publicUrl = $derived(`${location.origin}/${slug}`);

  onMount(async () => {
    try {
      setDetail(await admin.get(slug));
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    }
  });

  function setDetail(d: DataDirDetail) {
    detail = d;
    title = d.dataDir.title ?? "";
    description = d.dataDir.description ?? "";
    const l = d.dataDir.license ?? "";
    license = !l || LICENSES.includes(l) ? l : "other";
    customLicense = LICENSES.includes(l) ? "" : l;
    tags = d.dataDir.tags.join(", ");
    readme = d.readme ?? "";
  }

  /** Apply a changed data dir and re-read the rest (README, unregistered files). */
  async function refresh(updated?: DataDir) {
    const d = await admin.get(slug);
    if (updated) d.dataDir = updated;
    setDetail(d);
  }

  async function run(work: () => Promise<unknown>, done?: string) {
    busy = true;
    error = null;
    notice = null;
    try {
      await work();
      if (done) notice = done;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  const stepHref = (s: string) => `/admin/d/${slug}?step=${s}`;

  // --- Files ------------------------------------------------------------------

  async function addFiles(picked: PickedFile[]) {
    const prefix = subfolder.trim().replace(/^\/+|\/+$/g, "");
    const queue = picked.map((p) => ({
      ...p,
      path: prefix ? `${prefix}/${p.path}` : p.path,
    }));
    uploads = queue.map((q) => ({ path: q.path, size: q.file.size, progress: 0 }));
    busy = true;
    error = null;
    notice = null;
    let last: DataDir | undefined;
    const found: string[] = [];
    for (const [i, q] of queue.entries()) {
      const u = uploads[i]!;
      try {
        if (q.path === README) {
          // The README isn't a data file; it is the data dir's description.
          last = (await admin.saveReadme(slug, await q.file.text())).dataDir;
          found.push("README.md is now the README.");
        } else {
          if (/^licen[cs]e(\.(md|txt))?$/i.test(q.path) && !licenseValue) {
            const guess = guessLicense(await q.file.text());
            if (guess) {
              await admin.update(slug, { license: guess });
              found.push(`LICENSE looks like ${guess}; set as the license.`);
            }
          }
          last = await uploadFile(slug, q.path, q.file, (p) => (u.progress = p));
          u.sha256 = last.files.find((f) => f.path === q.path)?.sha256;
        }
        u.progress = 1;
        u.sha256 ??= "";
      } catch (e) {
        u.error = e instanceof Error ? e.message : String(e);
      }
    }
    busy = false;
    await refresh(last);
    if (found.length > 0) notice = found.join(" ");
    if (uploads.every((x) => !x.error)) uploads = [];
  }

  const uploadStatus = (u: Upload) =>
    u.error
      ? `failed: ${u.error}`
      : u.sha256 !== undefined
        ? u.sha256
          ? `done · sha256 ${shortHash(u.sha256)}`
          : "done"
        : u.progress < 1
          ? `uploading ${Math.floor(u.progress * 100)}%`
          : "hashing…";

  const deleteFile = (path: string) =>
    run(async () => refresh((await admin.deleteFile(slug, path)).dataDir), `Deleted ${path}.`);

  const register = (paths: string[]) =>
    run(async () => refresh((await admin.register(slug, paths)).dataDir), "Added and hashed.");

  /** Measure a CSV or JSON file with DuckDB in this browser, and save it as the file's schema. */
  const measure = (path: string, format: string) =>
    run(async () => {
      const db = await loadDuckDB(DUCKDB_CDN);
      const url = `${location.origin}/api/download?path=${encodeURIComponent(`${slug}/${path}`)}`;
      const { rows, schema } = await measureFile(db, url, format);
      await refresh((await admin.setProfile(slug, { path, format, rows, schema })).dataDir);
    }, `Measured ${path}.`);

  // --- Details ----------------------------------------------------------------

  const saveDetails = () =>
    run(
      async () => {
        const fields: { title: string; description: string; license?: string; tags: string[] } = {
          title,
          description,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        };
        if (!published) fields.license = licenseValue;
        let updated = (await admin.update(slug, fields)).dataDir;
        if (readme !== (detail?.readme ?? "")) {
          updated = readme.trim()
            ? (await admin.saveReadme(slug, readme)).dataDir
            : (await admin.deleteReadme(slug)).dataDir;
        }
        await refresh(updated);
      },
      published ? "Saved, and the record was updated." : "Saved.",
    );

  /** Fill the README (and an empty description and tags) with an AI draft, unsaved. */
  const draft = () =>
    run(async () => {
      const { draft } = await admin.draft(slug);
      readme = draft.readme || readme;
      if (!description.trim()) description = draft.description;
      if (!tags.trim()) tags = draft.tags.join(", ");
    }, "Drafted from the measured files. Review it, then save what you keep.");

  // --- Publish ----------------------------------------------------------------

  const publish = () =>
    run(async () => {
      await refresh((await admin.publish(slug)).dataDir);
      justPublished = true;
    });

  const unpublish = () =>
    run(async () => {
      await refresh((await admin.unpublish(slug)).dataDir);
      confirmUnpublish = false;
      justPublished = false;
    }, "Unpublished. The record is gone and it has left the feed.");

  const removeDir = () =>
    run(async () => {
      await admin.remove(slug);
      location.href = "/admin";
    });

  let steps = $derived([
    { label: "name", state: "done" as const },
    {
      label: "files",
      href: stepHref("files"),
      state: step === "files" ? ("current" as const) : ("done" as const),
    },
    {
      label: "details",
      href: stepHref("details"),
      state:
        step === "details"
          ? ("current" as const)
          : step === "review"
            ? ("done" as const)
            : ("todo" as const),
    },
    {
      label: "review",
      href: stepHref("review"),
      state: step === "review" ? ("current" as const) : ("todo" as const),
    },
  ]);
</script>

<svelte:head><title>{slug} · admin</title></svelte:head>

{#if loadError}
  <Notice tone="error" title="Couldn't load {slug}">{loadError}</Notice>
  <a href="/admin">Back to data dirs</a>
{:else if !dir}
  <Loading />
{:else}
  <div class="grid gap-6">
    <div class="grid gap-3">
      {#if published}
        <TabNav
          label="Data dir"
          current={step}
          items={[
            { id: "details", label: "Details", href: stepHref("details") },
            { id: "files", label: "Files", href: stepHref("files"), count: dir.files.length },
            { id: "review", label: "Record", href: stepHref("review") },
          ]}
        />
      {:else}
        <Stepper {steps} />
      {/if}
      <div class="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <h1 class="data text-page font-semibold break-all">{slug}</h1>
        <StatusMark status={published ? "live" : "dark"} label={dir.status} />
        <span class="ml-auto flex flex-wrap gap-x-4 text-meta">
          {#if published}
            <a href="/{slug}">public page</a>
            {#if onFeed}<a href={onFeed}>on {hostOf(data.config.appview!)} ↗</a>{/if}
          {/if}
        </span>
      </div>
    </div>

    {#if error}<Notice tone="error">{error}</Notice>{/if}
    {#if notice}<Notice tone="success">{notice}</Notice>{/if}

    {#if step === "files"}
      <!-- 1 · Files -------------------------------------------------------- -->
      <Section title="Files">
        {#snippet actions()}
          <span class="data text-muted"
            >{plural(dir.files.length, "file")} · {formatBytes(total)}</span
          >
        {/snippet}
        {#if published}
          <p class="text-meta text-muted">
            Files are fixed while the data dir is published, so its record keeps matching them.
            Unpublish to change them.
          </p>
        {:else}
          <p class="data text-muted">→ {location.host}/{slug}</p>
          <DropZone
            onfiles={addFiles}
            disabled={busy}
            hint="csv, tsv, parquet, json, jsonl, arrow, or anything else · large files upload in 50 MB parts · README.md becomes the README"
          />
          <label class="flex flex-wrap items-center gap-2 text-meta">
            <span class="text-muted">Put new files in a subfolder (optional)</span>
            <input class="input data max-w-56" bind:value={subfolder} placeholder="2026/q3" />
          </label>
        {/if}

        {#if uploads.length > 0}
          <div class="table-scroll">
            <table class="table data-table">
              <thead
                ><tr><th>uploading</th><th class="num">size</th><th>type</th><th>status</th></tr
                ></thead
              >
              <tbody>
                {#each uploads as u (u.path)}
                  <tr>
                    <td class="break-all">{u.path}</td>
                    <td class="num">{formatBytes(u.size)}</td>
                    <td class="nowrap"
                      >{guessFormat(u.path) ?? (u.path === README ? "readme" : "-")}</td
                    >
                    <td class="nowrap" aria-live="polite">{uploadStatus(u)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}

        {#if dir.files.length > 0}
          <FileTable files={dir.files} columns={["size", "rows", "format", "sha256"]}>
            {#snippet actions(f)}
              <span class="inline-flex gap-2 font-sans">
                {#if !f.schema && f.format && MEASURABLE.includes(f.format)}
                  <button
                    class="underline"
                    disabled={busy}
                    onclick={() => measure(f.path, f.format!)}>measure</button
                  >
                {/if}
                {#if !published}
                  <button class="underline" disabled={busy} onclick={() => deleteFile(f.path)}
                    >remove</button
                  >
                {/if}
              </span>
            {/snippet}
          </FileTable>
          <p class="text-meta text-muted">
            Each file is hashed (sha256) after it uploads; the hash goes in the record. Parquet
            schemas are measured on upload; measure CSV and JSON here, in your browser.
          </p>
        {:else if uploads.length === 0}
          <p class="text-meta text-muted">No data files yet.</p>
        {/if}

        {#if !published && detail && detail.unregistered.length > 0}
          <div class="grid gap-2">
            <div class="flex flex-wrap items-baseline gap-3">
              <span class="text-meta"
                >Already in the bucket under <code class="data">{slug}/</code>:</span
              >
              <Button
                size="sm"
                disabled={busy}
                onclick={() => register(detail!.unregistered.map((u) => u.path))}>add all</Button
              >
            </div>
            <ul class="grid gap-1 data">
              {#each detail.unregistered as u (u.path)}
                <li class="flex flex-wrap gap-3">
                  <span class="break-all">{u.path}</span>
                  <span class="text-muted">{formatBytes(u.size)}</span>
                  <button class="underline" disabled={busy} onclick={() => register([u.path])}
                    >add</button
                  >
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </Section>

      {#if !published}
        <div class="flex flex-wrap justify-between gap-2 border-t border-line pt-4">
          <Button href="/admin">Save draft</Button>
          <Button variant="primary" href={stepHref("details")}>Next: details →</Button>
        </div>
      {/if}
    {:else if step === "details"}
      <!-- 2 · Details ------------------------------------------------------ -->
      <form
        class="grid max-w-reading gap-5"
        onsubmit={(e) => {
          e.preventDefault();
          saveDetails();
        }}
      >
        <Field label="Title">
          <input class="input" bind:value={title} maxlength="200" placeholder={slug} />
        </Field>
        <Field
          label="Short description"
          hint="Shown in feeds and listings. {description.length}/280{description.length > 280
            ? ' — feeds cut it off here'
            : ''}"
        >
          <textarea class="input" rows="3" bind:value={description} maxlength="3000"></textarea>
        </Field>
        <Field
          label="README"
          hint="Saved as {slug}/README.md. Markdown. Empty it and save to remove it."
        >
          <textarea
            class="input code"
            rows="12"
            bind:value={readme}
            placeholder={`# ${title || slug}\n\nWhat's in this data, where it came from, how to use it.`}
          ></textarea>
        </Field>
        <div class="-mt-3 flex flex-wrap items-center gap-3 text-meta">
          <Button size="sm" disabled={busy || dir.files.length === 0} onclick={draft}
            >Draft with AI</Button
          >
          <span class="text-muted"
            >Drafts the README, description and tags from the measured files. Nothing is saved until
            you save.</span
          >
        </div>
        <Field
          label="License"
          hint={published
            ? "Fixed while published: people may already rely on it."
            : "How others may use this data. An SPDX identifier."}
        >
          <select class="input" bind:value={license} disabled={published}>
            <option value="">No license yet</option>
            {#each LICENSES as l (l)}<option value={l}>{l}</option>{/each}
            <option value="other">Other…</option>
          </select>
        </Field>
        {#if license === "other"}
          <Field label="Other license (SPDX identifier)">
            <input
              class="input data"
              bind:value={customLicense}
              disabled={published}
              placeholder="CC-BY-3.0"
            />
          </Field>
        {/if}
        <Field label="Tags" hint="Comma separated, lowercase words joined by dashes. Up to 20.">
          <input class="input" bind:value={tags} placeholder="wikipedia, pageviews, web" />
        </Field>
        <div class="grid gap-1">
          <span class="text-meta">Schema</span>
          {#each dir.files.filter((f) => f.format) as f (f.path)}
            <p class="text-meta">
              <span class="data">{f.path}</span>:
              {#if f.schema}
                <span class="data text-muted"
                  >{f.schema.map((c) => `${c.name} ${c.type.toLowerCase()}`).join(" · ")}</span
                >
              {:else if MEASURABLE.includes(f.format!)}
                <button
                  type="button"
                  class="underline"
                  disabled={busy}
                  onclick={() => measure(f.path, f.format!)}>measure</button
                >
              {:else}
                <span class="text-muted">not measured</span>
              {/if}
            </p>
          {:else}
            <p class="text-meta text-muted">No data files to describe yet.</p>
          {/each}
        </div>
        <div class="flex flex-wrap justify-between gap-2 border-t border-line pt-4">
          {#if published}
            <span></span>
            <Button type="submit" variant="primary" disabled={busy}>Save and update record</Button>
          {:else}
            <Button href={stepHref("files")}>← Back</Button>
            <span class="flex gap-2">
              <Button type="submit" disabled={busy}>Save</Button>
              <Button
                variant="primary"
                disabled={busy}
                onclick={async () => {
                  await saveDetails();
                  if (!error) await goto(stepHref("review"));
                }}>Save · next: review →</Button
              >
            </span>
          {/if}
        </div>
      </form>
    {:else}
      <!-- 3 · Review and publish (or the record, once published) ----------- -->
      <div class="grid max-w-reading gap-5">
        {#if justPublished}
          <Notice tone="success" title="Published. Lights on.">
            {slug} is live at {location.host}/{slug}, and its record is in your repo. It shows on
            the feed within seconds.
            {#snippet actions()}
              {#if onFeed}<Button size="sm" href={onFeed}>View on the feed</Button>{/if}
              <Button size="sm" href="/{slug}">Open the public page</Button>
              <CopyButton value={publicUrl} label="copy link" />
            {/snippet}
          </Notice>
        {/if}
        <MetaList
          rows={[
            {
              label: "URL",
              value: `${location.host}/${slug}`,
              mono: true,
              href: published ? `/${slug}` : null,
            },
            { label: "Title", value: dir.title || "(none — the name is used)" },
            { label: "Description", value: dir.description || "(none)" },
            {
              label: "Files",
              value: `${plural(dir.files.length, "file")} · ${formatBytes(total)} · ${dir.files.every((f) => f.sha256) ? "all hashed" : "hashing"}`,
            },
            {
              label: "README",
              value: dir.readmeSha256
                ? `README.md · sha256 ${shortHash(dir.readmeSha256)}`
                : "(none)",
            },
            { label: "License", value: dir.license || "(none)", mono: true },
            { label: "Tags", value: dir.tags.join(", ") || "(none)" },
            { label: "Record", value: recordUri, mono: true },
            ...(dir.recordCid ? [{ label: "CID", value: dir.recordCid, mono: true }] : []),
          ]}
        />

        {#if published}
          <p class="text-meta text-muted">
            Title, description, tags and README can change; each save updates the record. Files and
            license are fixed while published.
          </p>
          <div class="border-t border-line pt-4">
            <Button disabled={busy} onclick={() => (confirmUnpublish = true)}>Unpublish…</Button>
          </div>
        {:else}
          <Section title="On publish">
            <ul class="grid list-disc gap-1 pl-5 text-meta">
              <li>
                The record above is written to your AT Protocol repo
                {#if data.config.owner}(<span class="data">@{data.config.owner}</span>){/if}. It
                describes and points to the files; it never contains them.
              </li>
              <li>
                {#if data.config.appview}{hostOf(data.config.appview)} is told, so it appears on the feed.{:else}No
                  AppView is configured, so nothing is announced.{/if}
              </li>
              <li>
                The data dir and its files become publicly readable at {location.host}/{slug}.
              </li>
            </ul>
          </Section>
          {#if dir.files.length === 0}
            <Notice tone="error">Add at least one data file before publishing.</Notice>
          {:else}
            {#if !dir.license}
              <Notice>No license yet: people won't know how they may use the data.</Notice>
            {/if}
            {#if !dir.readmeSha256}
              <Notice>No README yet: say what's in the data and where it came from.</Notice>
            {/if}
          {/if}
          <p class="text-meta text-muted">
            You can unpublish later: the record is deleted, but copies people already made stay
            theirs.
          </p>
          <div class="flex flex-wrap justify-between gap-2 border-t border-line pt-4">
            <Button href={stepHref("details")}>← Back</Button>
            <span class="flex gap-2">
              <Button disabled={busy} onclick={() => (confirmRemove = true)}>Remove draft…</Button>
              <Button variant="primary" disabled={busy || dir.files.length === 0} onclick={publish}
                >{busy ? "Publishing…" : "Publish"}</Button
              >
            </span>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <Dialog
    bind:open={confirmUnpublish}
    title="Unpublish {slug}?"
    description="The record is deleted from your AT Protocol repo and the data dir leaves the feed. Files stay in your bucket."
  >
    {#snippet footer()}
      <Button onclick={() => (confirmUnpublish = false)}>Cancel</Button>
      <Button variant="primary" disabled={busy} onclick={unpublish}>Unpublish</Button>
    {/snippet}
  </Dialog>
  <Dialog
    bind:open={confirmRemove}
    title="Remove the draft {slug}?"
    description="The draft goes away. Its files stay in the bucket, so you can make it a data dir again."
  >
    {#snippet footer()}
      <Button onclick={() => (confirmRemove = false)}>Cancel</Button>
      <Button variant="primary" disabled={busy} onclick={removeDir}>Remove draft</Button>
    {/snippet}
  </Dialog>
{/if}
