<script lang="ts">
  import GithubListing from "$lib/components/github/GithubListing.svelte";
  import ApacheListing from "$lib/components/apache/ApacheListing.svelte";
  import { visualTheme, config } from "$lib/theme";

  let { data } = $props();
</script>

<svelte:head>
  <title>{data.currentPath ? data.currentPath.replace(/\/$/, "").split("/").pop() + " — " + $config.title : $config.title}</title>
</svelte:head>

{#if $visualTheme === "apache"}
  <ApacheListing listing={data.listing} currentPath={data.currentPath} />
{:else}
  <GithubListing listing={data.listing} currentPath={data.currentPath} />
{/if}
