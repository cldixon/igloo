<script lang="ts">
  import type { PublishedDataDir } from "@igloo/shared";

  let { dataDir }: { dataDir: PublishedDataDir } = $props();
</script>

<!-- A published data dir: its record on the network and where to find it. -->
<aside class="published" aria-label="Published data dir">
  <div class="line">
    <span class="tag">published</span>
    {#if dataDir.title}<strong class="title">{dataDir.title}</strong>{/if}
    {#if dataDir.license}<span class="license">{dataDir.license}</span>{/if}
    <a class="feed" href={dataDir.feedUrl}>view on the feed →</a>
  </div>
  {#if dataDir.description}<p class="description">{dataDir.description}</p>{/if}
  <code class="uri" title="The record announcing this data dir">{dataDir.recordUri}</code>
</aside>

<style>
  .published {
    border: 1px solid var(--border);
    border-left: 3px solid var(--accent);
    border-radius: var(--border-radius-sm);
    padding: 0.75rem 1rem;
    display: grid;
    gap: 0.375rem;
    font-size: 0.875rem;
    background: var(--bg-secondary);
  }
  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 0.75rem;
  }
  .tag {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--accent);
  }
  .license {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--text-secondary);
  }
  .feed {
    margin-left: auto;
    color: var(--accent);
  }
  .feed:hover {
    text-decoration: underline;
  }
  .description {
    color: var(--text-secondary);
  }
  .uri {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--text-muted);
    overflow-wrap: anywhere;
  }
</style>
