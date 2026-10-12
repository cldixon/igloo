<script lang="ts">
  import { TabNav } from "@igloo/ui";

  /** The home page's search box and its three views: feed, discover, search. */
  let { current, q = "" }: { current: "feed" | "discover" | "search"; q?: string } = $props();
</script>

<div class="grid gap-3">
  <form method="get" action="/search" role="search" class="flex gap-2">
    <input
      class="input"
      type="search"
      name="q"
      value={q}
      placeholder="Search data dirs, files, columns… e.g. col:lat tag:climate"
      aria-label="Search"
    />
    <button type="submit" class="shrink-0 border border-line px-3">Search</button>
  </form>
  <TabNav
    label="Home"
    {current}
    items={[
      { id: "feed", label: "Feed", href: "/" },
      { id: "discover", label: "Discover", href: "/discover" },
      { id: "search", label: "Search", href: q ? `/search?q=${encodeURIComponent(q)}` : "/search" },
    ]}
  />
</div>
