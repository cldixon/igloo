<script lang="ts">
  import "../app.css";
  import { page } from "$app/state";
  import { AccountMenu, Brand, NavLink, Shell, type MenuItem } from "@igloo/ui";

  let { data, children } = $props();

  async function signOut() {
    await fetch("/logout", { method: "POST" });
    location.href = "/";
  }

  let menu = $derived<MenuItem[]>(
    data.viewer
      ? [
          { label: "Your profile", href: `/m/${data.viewer.did}` },
          { label: "Sign out", onSelect: signOut },
        ]
      : [],
  );

  const at = (path: string) =>
    path === "/"
      ? ["/", "/discover", "/search"].includes(page.url.pathname)
      : page.url.pathname.startsWith(path);
</script>

<svelte:head>
  <title>igloo — social</title>
  <meta
    name="description"
    content="A network of personal, self-hosted data spaces, joined by AT Protocol."
  />
</svelte:head>

<Shell>
  {#snippet brand()}<Brand />{/snippet}
  {#snippet nav()}
    <NavLink href="/" current={at("/")}>home</NavLink>
    <NavLink href="/instances" current={at("/i") || at("/instances")}>instances</NavLink>
    <NavLink href="/deploy" current={at("/deploy")}>deploy your own</NavLink>
  {/snippet}
  {#snippet account()}
    {#if data.viewer}
      <AccountMenu
        label={data.viewer.handle ? `@${data.viewer.handle}` : data.viewer.did}
        items={menu}
      />
    {:else}
      <a href="/login" class="text-meta">sign in</a>
    {/if}
  {/snippet}
  {#snippet footer()}
    igloo AppView · indexes <code class="data">dev.cldixon.igloo.*</code> records · never stores or proxies
    data files
  {/snippet}
  {@render children()}
</Shell>
