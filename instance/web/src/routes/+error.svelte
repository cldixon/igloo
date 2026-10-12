<script lang="ts">
  import { page } from "$app/state";
  import { EmptyState } from "@igloo/ui";
</script>

<EmptyState title={page.status === 404 ? "Not found" : "Something went wrong"}>
  {page.error?.message ?? ""}
  {#snippet action()}<a href="/">Back to the index</a>{/snippet}
</EmptyState>
