<script lang="ts">
  import { onMount } from "svelte";
  import type { DataDir } from "@igloo/shared";
  import {
    admin,
    auth,
    type AuthStatus,
    type InstanceProfile,
    type NetworkStatus,
  } from "$lib/admin";
  import { formatBytes } from "$lib/utils";

  const ERRORS: Record<string, string> = {
    sign_in_failed: "Sign-in didn't complete. Try again.",
    not_owner: "That account doesn't own this instance.",
    unclaimed: "This instance hasn't been claimed yet. Sign in with the setup code.",
  };

  let status = $state<AuthStatus | null>(null);
  let error = $state<string | null>(null);

  // Sign-in form
  let handle = $state("");
  let setupCode = $state("");
  let signingIn = $state(false);

  // Dashboard
  let dataDirs = $state<DataDir[]>([]);
  let folders = $state<string[]>([]);
  let network = $state<NetworkStatus | null>(null);
  let instance = $state<InstanceProfile | null>(null);
  let instanceName = $state("");
  let instanceDescription = $state("");
  let newSlug = $state("");
  let newTitle = $state("");
  let busy = $state(false);

  onMount(async () => {
    const reason = new URL(location.href).searchParams.get("error");
    if (reason) error = ERRORS[reason] ?? "Sign-in failed.";
    status = await auth.status();
    if (status.signedIn) await loadDashboard();
  });

  async function loadDashboard() {
    const [list, found, net, inst] = await Promise.all([
      admin.list(),
      admin.folders(),
      admin.network(),
      admin.instance(),
    ]);
    dataDirs = list.dataDirs;
    folders = found.folders;
    network = net;
    instance = inst.instance;
    instanceName = instance.name ?? "";
    instanceDescription = instance.description ?? "";
  }

  async function run(work: () => Promise<unknown>) {
    busy = true;
    error = null;
    try {
      await work();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  async function signIn(event: SubmitEvent) {
    event.preventDefault();
    signingIn = true;
    error = null;
    try {
      const { url } = await auth.login(handle, status?.claimed ? undefined : setupCode);
      location.href = url;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      signingIn = false;
    }
  }

  const signOut = () =>
    run(async () => {
      await auth.logout();
      location.href = "/admin";
    });

  const create = (slug: string, title?: string) =>
    run(async () => {
      await admin.create(slug, { title });
      location.href = `/admin/d/${slug}`;
    });

  const saveInstance = () =>
    run(async () => {
      instance = (await admin.saveInstance(instanceName, instanceDescription)).instance;
    });
</script>

<svelte:head><title>Admin</title></svelte:head>

<div class="admin">
  {#if !status}
    <p class="muted">Loading…</p>
  {:else if !status.signedIn}
    <section class="panel" style="max-width: 30rem">
      <h1>Sign in</h1>
      {#if !status.claimed}
        <p class="muted">
          This instance hasn't been claimed. Sign in with your AT Protocol account and the setup
          code from deploying it; that account becomes the owner.
        </p>
      {:else}
        <p class="muted">Sign in with the account that owns this instance.</p>
      {/if}
      <form onsubmit={signIn} style="display: grid; gap: 0.75rem">
        <label>
          Handle
          <input
            bind:value={handle}
            placeholder="you.bsky.social"
            autocomplete="username"
            required
          />
        </label>
        {#if !status.claimed}
          <label>
            Setup code
            <input bind:value={setupCode} autocomplete="off" required />
          </label>
        {/if}
        {#if error}<p class="error">{error}</p>{/if}
        <div class="row">
          <button class="primary" disabled={signingIn}
            >{signingIn ? "Redirecting…" : "Sign in"}</button
          >
        </div>
      </form>
    </section>
  {:else}
    <div class="row">
      <h1>Admin</h1>
      <span class="spacer"></span>
      <code class="muted">{status.owner}</code>
      <button onclick={signOut} disabled={busy}>Sign out</button>
    </div>

    {#if error}<p class="error">{error}</p>{/if}

    <section class="panel">
      <div class="row">
        <h2>Data dirs</h2>
        <span class="spacer"></span>
        {#if network}
          <span class="muted"
            >{network.dataDirs.published} of {network.dataDirs.total} published · {formatBytes(
              network.storageBytes,
            )}</span
          >
        {/if}
      </div>
      {#if dataDirs.length === 0}
        <p class="muted">
          No data dirs yet. Create one below, or add a folder already in the bucket.
        </p>
      {:else}
        <div class="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Title</th><th>Files</th><th>Status</th></tr></thead>
            <tbody>
              {#each dataDirs as d (d.slug)}
                <tr>
                  <td><a class="link mono" href="/admin/d/{d.slug}">{d.slug}</a></td>
                  <td>{d.title ?? ""}</td>
                  <td>{d.files.length}</td>
                  <td><span class="status {d.status}">{d.status}</span></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
      <form
        class="row"
        onsubmit={(e) => {
          e.preventDefault();
          create(newSlug.trim(), newTitle.trim() || undefined);
        }}
      >
        <input
          bind:value={newSlug}
          placeholder="name, e.g. wikipedia-pageviews"
          style="flex: 1 1 14rem"
          required
        />
        <input bind:value={newTitle} placeholder="Title (optional)" style="flex: 1 1 14rem" />
        <button class="primary" disabled={busy}>New data dir</button>
      </form>
      {#if folders.length > 0}
        <div class="row">
          <span class="muted">Folders in the bucket:</span>
          {#each folders as folder (folder)}
            <button onclick={() => create(folder)} disabled={busy} title="Make {folder}/ a data dir"
              >+ {folder}/</button
            >
          {/each}
        </div>
      {/if}
    </section>

    <section class="panel">
      <h2>Instance profile</h2>
      <p class="muted">
        Published as this instance's record, so the feed can name it. Saving updates the record.
      </p>
      <label>Name <input bind:value={instanceName} placeholder="cldixon's igloo" /></label>
      <label
        >Description
        <input
          bind:value={instanceDescription}
          placeholder="Small public datasets I've collected or built."
        /></label
      >
      <div class="row">
        <button class="primary" onclick={saveInstance} disabled={busy || !instanceName.trim()}
          >Save and publish</button
        >
        {#if instance?.recordUri}<code class="muted">{instance.recordUri}</code>{/if}
      </div>
    </section>

    {#if network}
      <section class="panel">
        <h2>Network</h2>
        <div class="table-wrap">
          <table>
            <tbody>
              <tr>
                <td class="muted">PDS connection</td>
                <td>
                  {#if network.pds.ok}connected{:else}<span class="error">{network.pds.error}</span
                    >{/if}
                </td>
              </tr>
              <tr>
                <td class="muted">AppView</td>
                <td><a class="link" href={network.appview}>{network.appview}</a></td>
              </tr>
              <tr>
                <td class="muted">Instance record key</td>
                <td><code>{network.instanceRkey}</code></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    {/if}
  {/if}
</div>
