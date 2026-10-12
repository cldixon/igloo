<script lang="ts">
  /** A person's avatar from their Bluesky profile, or an empty circle. */
  let { src, size = 20 }: { src?: string | null; size?: number } = $props();
</script>

{#if src}
  <img
    {src}
    alt=""
    width={size}
    height={size}
    loading="lazy"
    class="inline-block shrink-0 rounded-full bg-sunken object-cover align-middle"
    style:width="{size}px"
    style:height="{size}px"
  />
{:else}
  <span
    aria-hidden="true"
    class="inline-block shrink-0 rounded-full border border-line-soft bg-sunken align-middle"
    style:width="{size}px"
    style:height="{size}px"
  ></span>
{/if}
