<script lang="ts">
  import { onMount } from "svelte";
  import Loading from "./Loading.svelte";
  import Notice from "./Notice.svelte";
  import { renderMarkdown, sha256Hex } from "../markdown.js";

  /**
   * A data dir's README, fetched from the instance and checked against the
   * sha256 in the record before it is shown.
   */
  let {
    url,
    sha256,
    resolve,
  }: { url: string; sha256?: string | null; resolve?: (path: string) => string } = $props();

  let html = $state<string | null>(null);
  let verified = $state<boolean | null>(null);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = await res.arrayBuffer();
      if (sha256) verified = (await sha256Hex(bytes)) === sha256;
      html = renderMarkdown(new TextDecoder().decode(bytes), resolve);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  });
</script>

{#if error}
  <Notice tone="error" title="Couldn't load the README from the instance">{error}</Notice>
{:else if html === null}
  <Loading label="Loading README…" />
{:else}
  {#if verified === false}
    <Notice tone="error" title="This README doesn't match its record">
      Its sha256 differs from the one published. It may have changed since.
    </Notice>
  {/if}
  <!-- Rendered by renderMarkdown, which escapes raw HTML and unsafe links. -->
  <div class="prose">{@html html}</div>
  {#if verified}<p class="data text-muted">✓ matches the sha256 in the record</p>{/if}
{/if}
