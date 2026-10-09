<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import type { DataDir } from "@igloo/shared";
  import { admin, auth, feedUrl, LICENSES, uploadFile, type DataDirDetail } from "$lib/admin";
  import { formatBytes, shortHash } from "$lib/utils";

  const slug = page.params.slug as string;

  let detail = $state<DataDirDetail | null>(null);
  let appview = $state("");
  let error = $state<string | null>(null);
  let notice = $state<string | null>(null);
  let busy = $state(false);

  let title = $state("");
  let description = $state("");
  let license = $state("");
  let readme = $state("");

  let subfolder = $state("");
  let uploads = $state<{ name: string; progress: number; error?: string }[]>([]);

  let dir = $derived(detail?.dataDir);
  let published = $derived(dir?.status === "published");

  onMount(async () => {
    const status = await auth.status();
    if (!status.signedIn) {
      location.href = "/admin";
      return;
    }
    const [d, net] = await Promise.all([admin.get(slug), admin.network()]);
    appview = net.appview;
    setDetail(d);
  });

  function setDetail(d: DataDirDetail) {
    detail = d;
    title = d.dataDir.title ?? "";
    description = d.dataDir.description ?? "";
    license = d.dataDir.license ?? "";
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

  const saveDetails = () =>
    run(
      async () => {
        const fields: { title: string; description: string; license?: string } = {
          title,
          description,
        };
        if (!published) fields.license = license;
        await refresh((await admin.update(slug, fields)).dataDir);
      },
      published ? "Saved, and the record was updated." : "Saved.",
    );

  const saveReadme = () =>
    run(async () => {
      if (readme.trim()) await refresh((await admin.saveReadme(slug, readme)).dataDir);
      else await refresh((await admin.deleteReadme(slug)).dataDir);
    }, "README saved.");

  const publish = () =>
    run(
      async () => refresh((await admin.publish(slug)).dataDir),
      "Published. It should be on the feed within seconds.",
    );

  const unpublish = () => {
    if (
      !confirm("Unpublish? The record is deleted from your repo and the data dir leaves the feed.")
    )
      return;
    return run(async () => refresh((await admin.unpublish(slug)).dataDir), "Unpublished.");
  };

  const deleteFile = (path: string) => {
    if (!confirm(`Delete ${path}? It is removed from the bucket too.`)) return;
    return run(async () => refresh((await admin.deleteFile(slug, path)).dataDir));
  };

  const register = (paths: string[]) =>
    run(async () => refresh((await admin.register(slug, paths)).dataDir), "Added and hashed.");

  const removeDir = () => {
    if (!confirm(`Remove the data dir "${slug}"? Its files stay in the bucket.`)) return;
    return run(async () => {
      await admin.remove(slug);
      location.href = "/admin";
    });
  };

  async function upload(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = "";
    const prefix = subfolder.trim().replace(/^\/+|\/+$/g, "");
    uploads = files.map((f) => ({ name: prefix ? `${prefix}/${f.name}` : f.name, progress: 0 }));
    busy = true;
    error = null;
    let last: DataDir | undefined;
    for (const [i, file] of files.entries()) {
      try {
        last = await uploadFile(slug, uploads[i]!.name, file, (p) => (uploads[i]!.progress = p));
        uploads[i]!.progress = 1;
      } catch (e) {
        uploads[i]!.error = e instanceof Error ? e.message : String(e);
      }
    }
    busy = false;
    await refresh(last);
    if (uploads.every((u) => !u.error)) uploads = [];
  }
</script>

<svelte:head><title>{slug} · Admin</title></svelte:head>

<div class="admin">
  <div class="row">
    <a class="link" href="/admin">← Admin</a>
    <span class="spacer"></span>
    <a class="link" href="/{slug}">Public listing</a>
  </div>

  {#if !dir}
    {#if error}<p class="error">{error}</p>{:else}<p class="muted">Loading…</p>{/if}
  {:else}
    <div class="row">
      <h1 class="mono" style="font-size: 1.375rem">{slug}</h1>
      <span class="status {dir.status}">{dir.status}</span>
      <span class="spacer"></span>
      {#if published}
        <button onclick={unpublish} disabled={busy}>Unpublish</button>
      {:else}
        <button class="primary" onclick={publish} disabled={busy || dir.files.length === 0}
          >Publish</button
        >
      {/if}
    </div>

    {#if error}<p class="error">{error}</p>{/if}
    {#if notice}<p class="muted">{notice}</p>{/if}

    {#if published && dir.recordUri}
      <section class="panel">
        <div class="row">
          <code>{dir.recordUri}</code>
          <span class="spacer"></span>
          {#if appview}<a class="link" href={feedUrl(appview, dir.recordUri)}>On the feed →</a>{/if}
        </div>
        <p class="muted">
          Files and license are fixed while published. Title, description and README can change;
          each save updates the record.
        </p>
      </section>
    {/if}

    <section class="panel">
      <h2>Details</h2>
      <label>Title <input bind:value={title} maxlength="200" /></label>
      <label>Description <input bind:value={description} maxlength="3000" /></label>
      <label>
        License
        <input
          bind:value={license}
          list="licenses"
          placeholder="SPDX identifier, e.g. CC-BY-4.0"
          disabled={published}
        />
        <datalist id="licenses">
          {#each LICENSES as l (l)}<option value={l}></option>{/each}
        </datalist>
      </label>
      <div class="row">
        <button class="primary" onclick={saveDetails} disabled={busy}>Save</button>
      </div>
    </section>

    <section class="panel">
      <div class="row">
        <h2>Files</h2>
        <span class="spacer"></span>
        <span class="muted"
          >{dir.files.length} · {formatBytes(dir.files.reduce((s, f) => s + f.size, 0))}</span
        >
      </div>
      {#if dir.files.length > 0}
        <div class="table-wrap">
          <table>
            <thead><tr><th>Path</th><th>Size</th><th>sha256</th><th></th></tr></thead>
            <tbody>
              {#each dir.files as f (f.path)}
                <tr>
                  <td class="mono">{f.path}</td>
                  <td>{formatBytes(f.size)}</td>
                  <td class="mono" title={f.sha256}>{shortHash(f.sha256)}</td>
                  <td style="text-align: right">
                    {#if !published}
                      <button class="danger" onclick={() => deleteFile(f.path)} disabled={busy}
                        >Delete</button
                      >
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="muted">No data files yet.</p>
      {/if}

      {#if !published}
        <div class="row">
          <input
            bind:value={subfolder}
            placeholder="Subfolder (optional)"
            style="flex: 0 1 14rem"
          />
          <label class="button" style="display: inline-block; color: inherit">
            Upload files…
            <input type="file" multiple onchange={upload} disabled={busy} hidden />
          </label>
          <span class="muted">Large files upload in 50 MB parts. Each is hashed after upload.</span>
        </div>
        {#each uploads as u (u.name)}
          <div class="row">
            <code>{u.name}</code>
            {#if u.error}<span class="error">{u.error}</span>{:else}<progress value={u.progress}
              ></progress>{/if}
          </div>
        {/each}

        {#if detail && detail.unregistered.length > 0}
          <div style="display: grid; gap: 0.5rem">
            <div class="row">
              <span class="muted"
                >Already in the bucket under {slug}/, not yet in the data dir:</span
              >
              <span class="spacer"></span>
              <button
                onclick={() => register(detail!.unregistered.map((u) => u.path))}
                disabled={busy}>Add all</button
              >
            </div>
            {#each detail.unregistered as u (u.path)}
              <div class="row">
                <code>{u.path}</code>
                <span class="muted">{formatBytes(u.size)}</span>
                <button onclick={() => register([u.path])} disabled={busy}>Add</button>
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </section>

    <section class="panel">
      <div class="row">
        <h2>README</h2>
        {#if dir.readmeSha256}<code class="muted" title={dir.readmeSha256}
            >sha256 {shortHash(dir.readmeSha256)}</code
          >{/if}
      </div>
      <textarea
        bind:value={readme}
        placeholder="# {title ||
          slug}&#10;&#10;What's in this data, where it came from, how to use it."></textarea>
      <div class="row">
        <button class="primary" onclick={saveReadme} disabled={busy}>Save README</button>
        <span class="muted">Saved as {slug}/README.md. Empty it and save to remove it.</span>
      </div>
    </section>

    {#if !published}
      <div class="row">
        <span class="spacer"></span>
        <button class="danger" onclick={removeDir} disabled={busy}>Remove data dir</button>
      </div>
    {/if}
  {/if}
</div>
