<script lang="ts">
  import RepoListing from "$lib/components/repo/RepoListing.svelte";
  import IndexListing from "$lib/components/index/IndexListing.svelte";
  import { visualTheme, config } from "$lib/theme";

  let { data } = $props();
</script>

<svelte:head>
  <title>{data.currentPath ? data.currentPath.replace(/\/$/, "").split("/").pop() + " — " + $config.title : $config.title}</title>
</svelte:head>

{#if $visualTheme === "index"}
  <IndexListing listing={data.listing} currentPath={data.currentPath} />
{:else}
  <RepoListing listing={data.listing} currentPath={data.currentPath} />
{/if}
