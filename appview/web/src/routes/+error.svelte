<script lang="ts">
  import { page } from "$app/state";
  import { EmptyState } from "@igloo/ui";
</script>

<svelte:head><title>{page.status === 404 ? "Not found" : "Error"} · igloo</title></svelte:head>

<EmptyState title={page.status === 404 ? "Not found" : "Something went wrong"}>
  {page.error?.message ?? ""}
  {#snippet action()}<a href="/">Back to the feed</a>{/snippet}
</EmptyState>
