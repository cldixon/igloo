<script lang="ts">
  /**
   * The wordmark slot. Pass 1 is the plain word; the logo mark lands here in
   * the visual pass. `context` names where you are ("data.example.com · admin").
   */
  let { href = "/", context }: { href?: string; context?: string | null } = $props();
</script>

<a {href} class="no-underline"><span class="font-semibold">igloo</span></a>{#if context}<span
    class="font-normal text-muted">{` · ${context}`}</span
  >{/if}
