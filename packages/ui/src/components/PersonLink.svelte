<script lang="ts">
  import Avatar from "./Avatar.svelte";
  import type { Person } from "../types.js";

  /** "@handle" with the avatar, linking to the person's page here. */
  let {
    person,
    avatar = true,
    name = false,
  }: { person: Person; avatar?: boolean; name?: boolean } = $props();

  let handle = $derived(person.handle ? `@${person.handle}` : person.did);
</script>

{#snippet body()}
  {#if avatar}<Avatar src={person.avatar} size={18} />{/if}
  {#if name && person.displayName}<span>{person.displayName}</span>
    <span class="text-muted">{handle}</span>{:else}<span>{handle}</span>{/if}
{/snippet}

{#if person.href}
  <a href={person.href} class="inline-flex items-center gap-1.5 align-bottom">{@render body()}</a>
{:else}
  <span class="inline-flex items-center gap-1.5 align-bottom">{@render body()}</span>
{/if}
