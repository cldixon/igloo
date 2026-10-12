<script lang="ts">
  import type { Status } from "../types.js";

  /**
   * The status slot: a lit igloo (published, online) or a dark one (draft,
   * unreachable). For now a filled or hollow square plus a word; the visual
   * pass swaps the mark for the igloo without touching any page. `compact`
   * keeps the word for screen readers only.
   */
  let {
    status,
    label,
    compact = false,
  }: { status: Status; label: string; compact?: boolean } = $props();
</script>

<span
  class="inline-flex items-center gap-1.5 data whitespace-nowrap text-muted"
  data-status={status}
  title={compact ? label : undefined}
>
  <span
    aria-hidden="true"
    class="inline-block size-2 shrink-0 border {status === 'live'
      ? 'border-live bg-live'
      : status === 'dark'
        ? 'border-dark bg-transparent'
        : 'border-dashed border-dark'}"
  ></span>
  <span class={compact ? "sr-only" : ""}>{label}</span>
</span>
