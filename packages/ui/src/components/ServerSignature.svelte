<script lang="ts">
  import type { Snippet } from "svelte";

  /** The AutoIndex nod: "igloo/0.1 Server at data.example.com Port 443". */
  let {
    host,
    version = "0.1",
    children,
  }: { host: string; version?: string; children?: Snippet } = $props();
</script>

<div class="flex flex-wrap justify-between gap-x-6 gap-y-1 data text-muted">
  <span>igloo/{version} Server at {host} Port 443</span>
  {#if children}<span class="flex flex-wrap gap-x-4">{@render children()}</span>{/if}
</div>
