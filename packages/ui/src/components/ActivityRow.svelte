<script lang="ts">
  import type { Snippet } from "svelte";
  import Avatar from "./Avatar.svelte";
  import StatusMark from "./StatusMark.svelte";
  import { timeAgo } from "../format.js";
  import type { InstanceRef, Person, Status } from "../types.js";

  /**
   * One event in a feed: "[status] avatar @actor published <data dir> on
   * <instance> · 2h", then a line of description and a monospace meta line.
   * Mirrored/updated events (later) are the same row with another verb.
   */
  let {
    actor,
    verb = "published",
    title,
    href,
    instance,
    when,
    description,
    meta = [],
    status = "live",
    actions,
  }: {
    actor: Person;
    verb?: string;
    title: string;
    href: string;
    instance?: InstanceRef | null;
    when?: string | null;
    description?: string | null;
    meta?: string[];
    status?: Status | null;
    actions?: Snippet;
  } = $props();

  let handle = $derived(actor.handle ? `@${actor.handle}` : actor.did);
</script>

<article class="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3 border-b border-line-soft py-3">
  <div class="pt-[0.4rem]">
    {#if status}<StatusMark
        {status}
        label={status === "live" ? "live" : "unreachable"}
        compact
      />{/if}
  </div>
  <div class="grid min-w-0 gap-1">
    <p class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <Avatar src={actor.avatar} size={18} />
      {#if actor.href}<a href={actor.href}>{handle}</a>{:else}<span>{handle}</span>{/if}
      <span class="text-muted">{verb}</span>
      <a {href} class="font-semibold break-all">{title}</a>
      {#if instance}
        <span class="text-muted">on</span>
        {#if instance.href}<a href={instance.href}>{instance.name ?? instance.url}</a>{:else}<span
            >{instance.name ?? instance.url}</span
          >{/if}
      {/if}
      {#if when}<span class="text-muted"
          >· <time datetime={when} title={when}>{timeAgo(when)}</time></span
        >{/if}
    </p>
    {#if description}<p class="max-w-reading line-clamp-2">{description}</p>{/if}
    {#if meta.length > 0 || actions}
      <p class="flex flex-wrap gap-x-3 gap-y-0.5 data text-muted">
        {#each meta as m, i (i)}<span>{m}</span>{/each}
        {#if actions}{@render actions()}{/if}
      </p>
    {/if}
  </div>
</article>
