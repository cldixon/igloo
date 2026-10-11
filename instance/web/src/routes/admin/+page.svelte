<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import type { DataDir } from "@igloo/shared";
  import {
    Button,
    Dialog,
    EmptyState,
    Loading,
    Notice,
    Section,
    SignInForm,
    StatusMark,
    formatBytes,
    formatDate,
    plural,
    shortDid,
  } from "@igloo/ui";
  import { admin, auth } from "$lib/admin";
  import { instanceName } from "$lib/api";

  let { data } = $props();

  const ERRORS: Record<string, string> = {
    sign_in_failed: "Sign-in didn't complete. Try again.",
    not_owner: "That account doesn't own this instance.",
    unclaimed: "This instance hasn't been claimed yet. Sign in with the setup code.",
  };

  let status = $derived(data.status);
  let error = $state<string | null>(null);

  // Sign-in
  let handle = $state("");
  let setupCode = $state("");
  let signingIn = $state(false);

  // Data dirs
  let dataDirs = $state<DataDir[] | null>(null);
  let folders = $state<string[]>([]);
  let filter = $state("");
  let busy = $state(false);
  let removing = $state<DataDir | null>(null);
  let unpublishing = $state<DataDir | null>(null);

  onMount(() => {
    const reason = page.url.searchParams.get("error");
    if (reason) error = ERRORS[reason] ?? "Sign-in failed.";
  });

  $effect(() => {
    if (status?.signedIn && dataDirs === null) void load();
  });

  async function load() {
    const [list, found] = await Promise.all([admin.list(), admin.folders()]);
    dataDirs = list.dataDirs;
    folders = found.folders;
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

  const adopt = (folder: string) =>
    run(async () => {
      await admin.create(folder);
      location.href = `/admin/d/${folder}`;
    });

  const confirmRemove = () =>
    run(async () => {
      await admin.remove(removing!.slug);
      removing = null;
      await load();
    });

  const confirmUnpublish = () =>
    run(async () => {
      await admin.unpublish(unpublishing!.slug);
      unpublishing = null;
      await load();
    });

  let shown = $derived(
    (dataDirs ?? []).filter(
      (d) =>
        !filter.trim() ||
        [d.slug, d.title ?? ""].some((s) => s.toLowerCase().includes(filter.trim().toLowerCase())),
    ),
  );
  let published = $derived((dataDirs ?? []).filter((d) => d.status === "published").length);
  const size = (d: DataDir) => d.files.reduce((s, f) => s + f.size, 0);
  const rkey = (uri: string) => uri.split("/").pop() ?? uri;
</script>

<svelte:head><title>Admin · {instanceName(data.config)}</title></svelte:head>

{#if !status}
  <Notice tone="error" title="Couldn't reach this instance's API">Reload to try again.</Notice>
{:else if !status.signedIn}
  <div class="grid max-w-form gap-4">
    {#if !status.claimed}
      <h1 class="text-page font-semibold">Claim this igloo</h1>
      <p>
        This instance has no owner yet. Sign in with your AT Protocol account and the setup code
        from deploying it; that account becomes its admin.
      </p>
    {:else}
      <h1 class="text-page font-semibold">Sign in</h1>
    {/if}
    <SignInForm bind:handle onsubmit={signIn} {error} busy={signingIn}>
      {#snippet fields()}
        {#if !status.claimed}
          <label class="grid gap-1">
            <span class="text-meta">Setup code</span>
            <input class="input data" bind:value={setupCode} autocomplete="off" required />
            <span class="text-meta text-muted"
              >Printed by <code class="data">igloo deploy</code>, and in the Worker's logs.</span
            >
          </label>
        {/if}
      {/snippet}
      {#snippet note()}
        {#if status.claimed}
          Owner: <code class="data">{status.owner ? shortDid(status.owner) : "-"}</code>. Only this
          account can administer the instance. Everyone else: <a href="/">browse the index</a>.
        {:else}
          You'll be redirected to your PDS to authorize. No email, no password. The setup code works
          once; after that this page is a normal sign-in.
        {/if}
      {/snippet}
    </SignInForm>
  </div>
{:else}
  <div class="grid gap-6">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <h1 class="text-page font-semibold">Data dirs</h1>
      <Button variant="primary" href="/admin/new" class="ml-auto">+ New data dir</Button>
    </div>

    {#if error}<Notice tone="error">{error}</Notice>{/if}

    {#if dataDirs === null}
      <Loading />
    {:else if dataDirs.length === 0}
      <EmptyState title="Nothing in here yet">
        Your igloo is built. Make a data dir, add its files, then publish it to the network.
        {#snippet action()}<Button href="/admin/new">+ New data dir</Button>{/snippet}
      </EmptyState>
    {:else}
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <input
          class="input max-w-60"
          type="search"
          bind:value={filter}
          placeholder="filter…"
          aria-label="Filter data dirs"
        />
        <span class="text-meta text-muted"
          >{published} published · {dataDirs.length - published} draft</span
        >
      </div>
      <div class="table-scroll">
        <table class="table">
          <thead>
            <tr>
              <th scope="col">name</th>
              <th scope="col">status</th>
              <th scope="col" class="num">files</th>
              <th scope="col" class="num">size</th>
              <th scope="col">updated</th>
              <th scope="col">record</th>
              <th scope="col"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {#each shown as d (d.slug)}
              <tr>
                <td class="min-w-40">
                  <a href="/admin/d/{d.slug}" class="data break-all">{d.slug}</a>
                  {#if d.title}<div class="text-muted">{d.title}</div>{/if}
                </td>
                <td
                  ><StatusMark
                    status={d.status === "published" ? "live" : "dark"}
                    label={d.status}
                  /></td
                >
                <td class="num data">{d.files.length}</td>
                <td class="num data">{formatBytes(size(d))}</td>
                <td class="data nowrap">{formatDate(d.updatedAt)}</td>
                <td class="data nowrap"
                  >{#if d.recordUri}<span title={d.recordUri}>…/{rkey(d.recordUri)}</span
                    >{:else}<span class="text-muted">-</span>{/if}</td
                >
                <td class="num">
                  {#if d.status === "published"}
                    <a href="/admin/d/{d.slug}?step=details">edit</a> ·
                    <button class="underline" disabled={busy} onclick={() => (unpublishing = d)}
                      >unpublish</button
                    >
                  {:else}
                    <a href="/admin/d/{d.slug}">continue</a> ·
                    <button class="underline" disabled={busy} onclick={() => (removing = d)}
                      >remove</button
                    >
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    {#if folders.length > 0}
      <Section
        title="Found in the bucket"
        description="Folders in this instance's R2 bucket that aren't data dirs yet. Make one into a data dir to hash its files and publish it."
      >
        <ul class="grid gap-1">
          {#each folders as folder (folder)}
            <li class="flex items-center gap-3">
              <code class="data">{folder}/</code>
              <Button size="sm" disabled={busy} onclick={() => adopt(folder)}>make data dir</Button>
            </li>
          {/each}
        </ul>
      </Section>
    {/if}
  </div>

  <Dialog
    open={removing !== null}
    onOpenChange={(o: boolean) => !o && (removing = null)}
    title="Remove {removing?.slug}?"
    description="The draft goes away. Its files stay in the bucket, so you can make it a data dir again."
  >
    {#snippet footer()}
      <Button onclick={() => (removing = null)}>Cancel</Button>
      <Button variant="primary" disabled={busy} onclick={confirmRemove}>Remove draft</Button>
    {/snippet}
  </Dialog>
  <Dialog
    open={unpublishing !== null}
    onOpenChange={(o: boolean) => !o && (unpublishing = null)}
    title="Unpublish {unpublishing?.slug}?"
    description="The record is deleted from your AT Protocol repo and the data dir leaves the feed. Files stay in your bucket; anyone who already downloaded them keeps their copy."
  >
    {#snippet footer()}
      <Button onclick={() => (unpublishing = null)}>Cancel</Button>
      <Button variant="primary" disabled={busy} onclick={confirmUnpublish}>Unpublish</Button>
    {/snippet}
  </Dialog>
{/if}
