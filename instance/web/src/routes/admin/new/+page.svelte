<script lang="ts">
  import { Button, Field, Notice, Stepper } from "@igloo/ui";
  import { admin } from "$lib/admin";

  let slug = $state("");
  let title = $state("");
  let busy = $state(false);
  let error = $state<string | null>(null);

  // Names become URLs and record keys: lowercase, digits, ".", "_", "-".
  let suggested = $derived(
    slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
      .slice(0, 64),
  );

  async function create(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    error = null;
    try {
      await admin.create(suggested, { title: title.trim() || undefined });
      location.href = `/admin/d/${suggested}`;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      busy = false;
    }
  }
</script>

<svelte:head><title>New data dir</title></svelte:head>

<div class="grid max-w-reading gap-5">
  <Stepper
    steps={[
      { label: "name", state: "current" },
      { label: "files", state: "todo" },
      { label: "details", state: "todo" },
      { label: "review", state: "todo" },
    ]}
  />
  <h1 class="text-page font-semibold">New data dir</h1>
  <p class="text-muted">
    A data dir is a folder of data files with a README and a license. Name it, add its files, then
    publish it to the network. It stays a private draft until you do.
  </p>
  <form class="grid max-w-form gap-4" onsubmit={create}>
    <Field label="Directory name (URL slug)">
      <input
        class="input data"
        bind:value={slug}
        placeholder="wikipedia-pageviews"
        autocapitalize="none"
        spellcheck="false"
        required
      />
      {#snippet hint()}<span class="data">→ {location.host}/{suggested || "…"}</span>{/snippet}
    </Field>
    <Field label="Title (optional)" hint="You can change it later.">
      <input class="input" bind:value={title} placeholder="Wikipedia pageviews, Q3 2026" />
    </Field>
    {#if error}<Notice tone="error">{error}</Notice>{/if}
    <div class="flex gap-2">
      <Button type="submit" variant="primary" disabled={busy || !suggested}>Next: files →</Button>
      <Button href="/admin">Cancel</Button>
    </div>
  </form>
</div>
