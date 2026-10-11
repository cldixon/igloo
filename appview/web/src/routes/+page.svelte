<script lang="ts">
  import { EmptyState, SignInForm, plural } from "@igloo/ui";
  import HomeTabs from "$lib/HomeTabs.svelte";
  import EntryRow from "$lib/EntryRow.svelte";

  let { data } = $props();
</script>

<div class="grid gap-8">
  {#if !data.viewer}
    <section
      class="grid gap-6 border-b border-line pb-8 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-end"
    >
      <h1 class="text-hero font-semibold tracking-tight">small, personal data spaces.</h1>
      <div class="grid gap-4">
        <p>
          Each person hosts their own data on their own igloo. Publishing announces it on AT
          Protocol, and this is where everyone's data dirs meet: browse, download, and query them in
          your browser.
        </p>
        <SignInForm action="/login">
          {#snippet note()}
            Or just browse. <a href="/deploy">Deploy your own igloo →</a>
          {/snippet}
        </SignInForm>
      </div>
    </section>
  {/if}

  <HomeTabs current="feed" />

  <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
    <section aria-label="Recently published" class="grid content-start gap-2">
      <p class="text-meta text-muted">
        <span class="font-semibold text-fg">All instances</span> ·
        <span title="Following arrives with follows">following (later)</span>
      </p>
      {#if data.entries.length === 0}
        <EmptyState title="Nothing published yet">
          When someone publishes a data dir from their igloo, it shows up here within seconds.
          {#snippet action()}<a href="/deploy">Deploy your own igloo</a>{/snippet}
        </EmptyState>
      {:else}
        <div>
          {#each data.entries as entry (entry.href)}<EntryRow {entry} />{/each}
        </div>
        {#if data.next}<a href="/?before={encodeURIComponent(data.next)}">older →</a>{/if}
      {/if}
    </section>

    <aside class="grid content-start gap-6 text-meta">
      {#if data.viewer}
        <section class="grid gap-2 border border-line p-3">
          <h2 class="eyebrow">Welcome back</h2>
          <p class="data">{data.viewer.handle ? `@${data.viewer.handle}` : data.viewer.did}</p>
          {#if data.yours.length > 0}
            {#each data.yours as i (i.href)}
              <p><a href={i.href}>{i.name}</a> · <a href="{i.url}/admin">open admin ↗</a></p>
            {/each}
          {:else}
            <p class="text-muted">You don't run an igloo yet.</p>
            <a href="/deploy">Deploy your own →</a>
          {/if}
        </section>
      {/if}
      <section class="grid gap-2">
        <h2 class="eyebrow">Instances</h2>
        {#if data.instances.length === 0}
          <p class="text-muted">None yet.</p>
        {:else}
          <ul class="grid gap-1">
            {#each data.instances as i (i.href)}
              <li class="flex justify-between gap-2">
                <a href={i.href} class="truncate">{i.name}</a>
                <span class="data text-muted">{i.dataDirs}</span>
              </li>
            {/each}
          </ul>
          <a href="/instances">all {plural(data.instanceCount, "instance")} →</a>
        {/if}
      </section>
      {#if data.newest.length > 0}
        <section class="grid gap-2">
          <h2 class="eyebrow">New instances</h2>
          <ul class="grid gap-1">
            {#each data.newest as i (i.href)}<li><a href={i.href}>{i.name}</a></li>{/each}
          </ul>
        </section>
      {/if}
      <section class="grid gap-1">
        <h2 class="eyebrow">Trending this week</h2>
        <p class="text-muted">Arrives with likes, mirrors and query counts.</p>
      </section>
    </aside>
  </div>
</div>
