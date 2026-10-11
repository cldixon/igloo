<script lang="ts">
  import type { Snippet } from "svelte";
  import { queryFiles } from "@igloo/query";
  import Breadcrumbs from "./Breadcrumbs.svelte";
  import Button from "./Button.svelte";
  import CopyButton from "./CopyButton.svelte";
  import FileTable from "./FileTable.svelte";
  import PageHeader from "./PageHeader.svelte";
  import PersonLink from "./PersonLink.svelte";
  import QueryPanel from "./QueryPanel.svelte";
  import Readme from "./Readme.svelte";
  import StatusMark from "./StatusMark.svelte";
  import TabNav from "./TabNav.svelte";
  import EmptyState from "./EmptyState.svelte";
  import { formatBytes, formatDate, formatsOf, hostOf, plural } from "../format.js";
  import type { Crumb, DataDirModel, TabItem } from "../types.js";

  /**
   * A published data dir, the same on the AppView and on its own instance:
   * header with byline and actions, then tabs for files, README, schema,
   * query, mirrors (later) and the record. Each tab has its own URL.
   */
  let {
    dataDir: d,
    tab,
    tabHref,
    breadcrumb,
    elsewhere,
    tagHref,
    columnHref,
    extraActions,
  }: {
    dataDir: DataDirModel;
    tab: string;
    tabHref: (tab: string) => string;
    breadcrumb: Crumb[];
    /** The same data dir on the other surface ("view on igloo.social"). */
    elsewhere?: { label: string; href: string } | null;
    tagHref?: (tag: string) => string;
    columnHref?: (column: string) => string;
    extraActions?: Snippet;
  } = $props();

  let dataFiles = $derived(d.files.filter((f) => f.format));
  let total = $derived(d.files.reduce((sum, f) => sum + f.size, 0));
  let described = $derived(d.files.filter((f) => f.schema && f.schema.length > 0));
  let queryable = $derived(
    queryFiles(d.files, (path) => d.files.find((f) => f.path === path)?.url ?? path),
  );
  let single = $derived(d.files.length === 1 ? d.files[0] : null);
  let first = $derived(
    queryable[0] ? d.files.find((f) => f.url === queryable[0]!.url) : d.files[0],
  );

  let tabs = $derived<TabItem[]>([
    { id: "files", label: "Files", href: tabHref("files"), count: d.files.length },
    ...(d.readme ? [{ id: "readme", label: "README", href: tabHref("readme") }] : []),
    { id: "schema", label: "Schema", href: tabHref("schema"), disabled: described.length === 0 },
    { id: "query", label: "Query", href: tabHref("query"), disabled: queryable.length === 0 },
    { id: "mirrors", label: "Mirrors", href: tabHref("mirrors"), disabled: true },
    { id: "record", label: "Record", href: tabHref("record") },
  ]);
  let current = $derived(tabs.some((t) => t.id === tab && !t.disabled) ? tab : "files");

  const pdsls = (uri: string) => `https://pdsls.dev/${uri}`;
</script>

<div class="grid gap-6">
  <PageHeader title={d.title ?? d.name} description={d.description}>
    {#snippet crumbs()}<Breadcrumbs items={breadcrumb} />{/snippet}
    {#snippet meta()}
      <span class="flex flex-wrap items-center gap-x-2 gap-y-1">
        {#if d.maintainer}<span>by <PersonLink person={d.maintainer} name /></span><span
            aria-hidden="true">·</span
          >{/if}
        <span
          >on {#if d.instance.href}<a href={d.instance.href}
              >{d.instance.name ?? hostOf(d.instance.url)}</a
            >{:else}{d.instance.name ?? hostOf(d.instance.url)}{/if}</span
        >
        {#if d.instance.status}<StatusMark
            status={d.instance.status}
            label={d.instance.status === "live" ? "online" : "unreachable"}
          />{/if}
        {#if d.license}<span aria-hidden="true">·</span><span class="data">{d.license}</span>{/if}
        {#if d.publishedAt}<span aria-hidden="true">·</span><span
            >published <time class="data" datetime={d.publishedAt}>{formatDate(d.publishedAt)}</time
            ></span
          >{/if}
      </span>
      {#if d.tags.length > 0}
        <span class="mt-1 flex flex-wrap gap-x-2">
          <span>tags:</span>
          {#each d.tags as t (t)}
            {#if tagHref}<a href={tagHref(t)}>{t}</a>{:else}<span>{t}</span>{/if}
          {/each}
        </span>
      {/if}
    {/snippet}
    {#snippet actions()}
      {#if single?.url}
        <Button variant="primary" href={single.url}>Download ({formatBytes(single.size)})</Button>
      {:else}
        <Button variant="primary" href={tabHref("files")}
          >{plural(d.files.length, "file")} · {formatBytes(total)}</Button
        >
      {/if}
      {#if queryable.length > 0}<Button href={tabHref("query")}>Query (SQL)</Button>{/if}
      <Button disabled title="Mirrors arrive in a later phase">Mirror to my igloo</Button>
      {@render extraActions?.()}
      {#if elsewhere}<a class="text-center text-meta" href={elsewhere.href}>{elsewhere.label} ↗</a
        >{/if}
      <p class="text-center data text-muted" title="Counts arrive with mirrors and citations">
        mirrors · queries · cites: later
      </p>
    {/snippet}
  </PageHeader>

  <TabNav items={tabs} {current} label="Data dir" />

  {#if current === "files"}
    <div class="grid gap-3">
      <FileTable files={d.files} columns={["size", "rows", "format", "sha256"]}>
        {#snippet actions(f)}{#if f.url}<a href={f.url}>download</a>{/if}{/snippet}
      </FileTable>
      <p class="data text-muted">
        {plural(d.files.length, "file")} · {formatBytes(
          total,
        )}{#if formatsOf(dataFiles)}{` · ${formatsOf(dataFiles)}`}{/if}
      </p>
      {#if first?.url}
        <div class="grid gap-1 text-meta">
          <span class="eyebrow">Direct</span>
          <code class="data break-all">{first.url}</code>
          <span class="flex flex-wrap gap-x-4 data">
            <CopyButton value={first.url} label="copy url" />
            <CopyButton
              value={`wget -O '${first.path.split("/").pop()}' '${first.url}'`}
              label="copy wget"
            />
            <CopyButton
              value={`curl -L -o '${first.path.split("/").pop()}' '${first.url}'`}
              label="copy curl"
            />
            {#if queryable.length > 0}
              <CopyButton value={`SELECT * FROM '${first.url}' LIMIT 100;`} label="copy duckdb" />
            {/if}
          </span>
        </div>
      {/if}
      <p class="text-meta text-muted">
        Files download straight from {hostOf(d.instance.url)}. Check a download against its record
        with <code class="data">sha256sum &lt;file&gt;</code>.
      </p>
    </div>
  {:else if current === "readme" && d.readme}
    <Readme
      url={d.readme.url}
      sha256={d.readme.sha256}
      resolve={(path) =>
        d.files.find((f) => f.path === path)?.url ??
        d.readme!.url.replace(/README\.md(\?.*)?$/i, path)}
    />
  {:else if current === "schema"}
    <div class="grid gap-6">
      {#each described as f (f.path)}
        <section class="grid gap-2">
          <h2 class="data font-semibold break-all">{f.path}</h2>
          <p class="data text-muted">
            {f.format ?? "-"} · {plural(
              f.schema!.length,
              "column",
            )}{#if f.rows != null}{` · ${plural(f.rows, "row")}`}{/if}
          </p>
          <div class="table-scroll">
            <table class="table data-table max-w-reading">
              <thead><tr><th scope="col">column</th><th scope="col">type</th></tr></thead>
              <tbody>
                {#each f.schema! as c (c.name)}
                  <tr>
                    <td class="break-all"
                      >{#if columnHref}<a href={columnHref(c.name)}>{c.name}</a
                        >{:else}{c.name}{/if}</td
                    >
                    <td class="nowrap text-muted">{c.type}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </section>
      {/each}
      <p class="text-meta text-muted">Measured from the files themselves, never guessed.</p>
    </div>
  {:else if current === "query"}
    <QueryPanel files={queryable} />
  {:else if current === "record"}
    <div class="grid gap-3">
      {#if d.recordUri}
        <code class="data break-all">{d.recordUri}</code>
        {#if d.recordCid}<code class="data break-all text-muted">cid {d.recordCid}</code>{/if}
        {#if d.record}
          <pre class="overflow-x-auto bg-sunken p-3 data">{JSON.stringify(d.record, null, 2)}</pre>
        {/if}
        <p class="flex flex-wrap gap-x-4 data">
          <a href={pdsls(d.recordUri)}>view on pdsls ↗</a>
          <CopyButton value={d.recordUri} label="copy at-uri" />
          {#if d.record}<CopyButton
              value={JSON.stringify(d.record, null, 2)}
              label="copy json"
            />{/if}
        </p>
        <p class="text-meta text-muted">
          The record lives in the maintainer's AT Protocol repo. It describes and points to the
          data; it never contains it.
        </p>
      {:else}
        <EmptyState title="No record"
          >This data dir hasn't been published to the network.</EmptyState
        >
      {/if}
    </div>
  {/if}
</div>
