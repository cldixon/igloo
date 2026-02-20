<script lang="ts">
  import { marked } from "marked";

  let { content }: { content: string } = $props();

  let html = $derived(marked.parse(content));
</script>

<div class="readme-card">
  <div class="readme-header">
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16">
      <path d="M4 2h8l4 4v12a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2z" />
      <path d="M5 10h10M5 13h7" />
    </svg>
    <span>README.md</span>
  </div>
  <div class="readme-content">
    {#await html then rendered}
      {@html rendered}
    {/await}
  </div>
</div>

<style>
  .readme-card {
    margin-top: 2rem;
    border: 1px solid var(--border);
    border-radius: var(--border-radius);
    overflow: hidden;
  }

  .readme-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background-color: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .readme-content {
    padding: 1.5rem;
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    line-height: 1.7;
    color: var(--text-primary);
  }

  .readme-content :global(h1),
  .readme-content :global(h2),
  .readme-content :global(h3) {
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
    font-family: var(--font-sans);
    color: var(--text-primary);
  }

  .readme-content :global(h1) { font-size: 1.5rem; }
  .readme-content :global(h2) { font-size: 1.25rem; }
  .readme-content :global(h3) { font-size: 1.1rem; }

  .readme-content :global(p) {
    margin-bottom: 1rem;
  }

  .readme-content :global(code) {
    font-family: var(--font-mono);
    font-size: 0.85em;
    background-color: var(--bg-secondary);
    padding: 0.15em 0.4em;
    border-radius: var(--border-radius-sm);
  }

  .readme-content :global(pre) {
    background-color: var(--bg-secondary);
    padding: 1rem;
    border-radius: var(--border-radius-sm);
    overflow-x: auto;
    margin-bottom: 1rem;
  }

  .readme-content :global(pre code) {
    background: none;
    padding: 0;
  }

  .readme-content :global(a) {
    color: var(--accent);
  }

  .readme-content :global(ul),
  .readme-content :global(ol) {
    padding-left: 1.5rem;
    margin-bottom: 1rem;
  }

  .readme-content :global(li) {
    margin-bottom: 0.25rem;
  }

  .readme-content :global(blockquote) {
    border-left: 3px solid var(--accent);
    padding-left: 1rem;
    margin-left: 0;
    color: var(--text-secondary);
  }
</style>
