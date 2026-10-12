<script lang="ts">
  import "../app.css";
  import { page } from "$app/state";
  import { goto, invalidate } from "$app/navigation";
  import { AccountMenu, NavLink, ServerSignature, Shell, hostOf, type MenuItem } from "@igloo/ui";
  import { auth } from "$lib/admin";
  import { appviewUrl, instanceName } from "$lib/api";

  let { data, children } = $props();

  let host = $derived(location.host);
  let inAdmin = $derived(page.url.pathname.startsWith("/admin"));
  let signedIn = $derived(data.status?.signedIn ?? false);
  let name = $derived(instanceName(data.config));
  let handle = $derived(
    data.config.owner ? `@${data.config.owner}` : (data.config.ownerDid ?? "owner"),
  );
  let instancePage = $derived(
    data.config.ownerDid ? appviewUrl(data.config, `/i/${data.config.ownerDid}/${host}`) : null,
  );

  async function signOut() {
    await auth.logout().catch(() => {});
    await invalidate("igloo:session");
    await goto("/");
  }

  let menu = $derived<MenuItem[]>([
    ...(inAdmin ? [{ label: "Public index", href: "/" }] : [{ label: "Admin", href: "/admin" }]),
    { label: "Settings", href: "/admin/settings" },
    ...(instancePage
      ? [{ label: `On ${hostOf(data.config.appview!)} ↗`, href: instancePage }]
      : []),
    { label: "Sign out", onSelect: signOut },
  ]);

  const section = (path: string) =>
    path === "/admin"
      ? page.url.pathname === "/admin" ||
        page.url.pathname.startsWith("/admin/d/") ||
        page.url.pathname === "/admin/new"
      : page.url.pathname.startsWith(path);
</script>

<svelte:head>
  <title>{name}</title>
  {#if data.config.description}<meta name="description" content={data.config.description} />{/if}
</svelte:head>

<Shell>
  {#snippet brand()}
    {#if inAdmin}
      <a href="/admin" class="no-underline">{host}</a><span class="font-normal text-muted"
        >{" · admin"}</span
      >
    {:else}
      <a href="/" class="no-underline">{name}</a>
    {/if}
  {/snippet}
  {#snippet nav()}
    {#if inAdmin && signedIn}
      <NavLink href="/admin" current={section("/admin")}>data dirs</NavLink>
      <NavLink href="/admin/settings" current={section("/admin/settings")}>settings</NavLink>
    {/if}
  {/snippet}
  {#snippet account()}
    {#if signedIn}
      <AccountMenu label={handle} items={menu} />
    {:else if !inAdmin}
      <a href="/admin" class="text-meta text-muted">sign in</a>
    {:else}
      <a href="/" class="text-meta text-muted">public index</a>
    {/if}
  {/snippet}
  {#snippet footer()}
    <ServerSignature {host}>
      {#if !inAdmin}
        <a href="/api/datadirs">index.json</a>
        {#if instancePage}<a href={instancePage}>{hostOf(data.config.appview!)}/i/{host}</a>{/if}
      {/if}
    </ServerSignature>
  {/snippet}
  {@render children()}
</Shell>
