<script lang="ts">
  import { onMount } from "svelte";
  import {
    Button,
    Field,
    Loading,
    MetaList,
    Notice,
    Section,
    StatusMark,
    formatBytes,
    formatDate,
    hostOf,
  } from "@igloo/ui";
  import { admin, type ApiToken, type InstanceProfile, type NetworkStatus } from "$lib/admin";
  import { appviewUrl } from "$lib/api";
  import { invalidate } from "$app/navigation";

  let { data } = $props();

  let instance = $state<InstanceProfile | null>(null);
  let network = $state<NetworkStatus | null>(null);
  let tokens = $state<ApiToken[]>([]);
  let name = $state("");
  let description = $state("");
  let tokenName = $state("");
  let tokenDays = $state(90);
  let newToken = $state<string | null>(null);
  let busy = $state(false);
  let error = $state<string | null>(null);
  let notice = $state<string | null>(null);

  const SECTIONS = [
    ["instance", "Instance"],
    ["owner", "Owner"],
    ["network", "Network"],
    ["tokens", "API tokens"],
    ["storage", "Storage"],
  ] as const;

  onMount(async () => {
    try {
      const [inst, net, tok] = await Promise.all([
        admin.instance(),
        admin.network(),
        admin.tokens(),
      ]);
      instance = inst.instance;
      network = net;
      tokens = tok.tokens;
      name = instance.name ?? "";
      description = instance.description ?? "";
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  });

  async function run(work: () => Promise<unknown>, done?: string) {
    busy = true;
    error = null;
    notice = null;
    try {
      await work();
      if (done) notice = done;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  const saveInstance = () =>
    run(async () => {
      instance = (await admin.saveInstance(name, description)).instance;
      await invalidate("igloo:session");
    }, "Saved, and the instance record was updated.");

  const createToken = () =>
    run(async () => {
      newToken = (await admin.createToken(tokenName.trim(), tokenDays)).token;
      tokenName = "";
      tokens = (await admin.tokens()).tokens;
    });

  const revokeToken = (t: ApiToken) => {
    if (!confirm(`Revoke "${t.name}"? Anything using it stops working.`)) return;
    return run(async () => {
      await admin.revokeToken(t.id);
      tokens = (await admin.tokens()).tokens;
    });
  };
</script>

<svelte:head><title>Settings · admin</title></svelte:head>

<div class="grid gap-6 md:grid-cols-[10rem_minmax(0,1fr)]">
  <nav aria-label="Settings" class="md:sticky md:top-4 md:self-start">
    <ul class="flex flex-wrap gap-x-4 gap-y-1 text-meta md:grid md:gap-2">
      {#each SECTIONS as [id, label] (id)}<li><a href="#{id}">{label}</a></li>{/each}
    </ul>
  </nav>

  <div class="grid max-w-reading gap-10">
    <h1 class="text-page font-semibold">Settings</h1>
    {#if error}<Notice tone="error">{error}</Notice>{/if}
    {#if notice}<Notice tone="success">{notice}</Notice>{/if}

    {#if !instance || !network}
      <Loading />
    {:else}
      <Section
        id="instance"
        title="Instance"
        description="Published as this instance's record, so the network can name it. Saving updates the record."
      >
        <form
          class="grid gap-4"
          onsubmit={(e) => {
            e.preventDefault();
            saveInstance();
          }}
        >
          <Field label="Display name">
            <input class="input" bind:value={name} placeholder="cldixon's igloo" required />
          </Field>
          <Field label="Description">
            <textarea
              class="input"
              rows="2"
              bind:value={description}
              placeholder="Datasets I collect and clean."></textarea>
          </Field>
          <Field label="Public URL" hint="Set by the custom domain in igloo.config.json.">
            <input class="input data" value={instance.url} disabled />
          </Field>
          <Field
            label="Default index view"
            hint="Set with theme in igloo.config.json (repo = pretty, index = classic). Visitors can switch per page."
          >
            <input
              class="input"
              value={data.config.theme === "index" ? "Classic (AutoIndex)" : "Pretty"}
              disabled
            />
          </Field>
          <div>
            <Button type="submit" variant="primary" disabled={busy || !name.trim()}
              >Save and update record</Button
            >
          </div>
        </form>
      </Section>

      <Section id="owner" title="Owner">
        <MetaList
          rows={[
            {
              label: "Handle",
              value: data.config.owner ? `@${data.config.owner}` : "(unresolved)",
            },
            { label: "DID", value: network.owner, mono: true },
            {
              label: "Profile",
              value: data.config.appview ? `${hostOf(data.config.appview)}/m/…` : "-",
              href: appviewUrl(data.config, `/m/${network.owner}`),
            },
          ]}
        />
        <p class="flex items-center gap-2 text-meta">
          <StatusMark
            status={network.pds.ok ? "live" : "dark"}
            label={network.pds.ok ? "connected to your PDS" : "not connected"}
          />
        </p>
        {#if !network.pds.ok}
          <Notice tone="error">{network.pds.error} Publishing needs this connection.</Notice>
        {/if}
        <p class="text-meta text-muted">
          Ownership is tied to this AT Protocol account. Transferring an instance isn't supported
          yet.
        </p>
      </Section>

      <Section id="network" title="Network">
        <MetaList
          rows={[
            {
              label: "AppView",
              value: network.appview || "(none configured)",
              href: network.appview || null,
              mono: true,
            },
            {
              label: "Instance record",
              value: instance.recordUri ?? "(not published yet — save the instance above)",
              mono: true,
            },
            { label: "Record key", value: network.instanceRkey, mono: true },
            {
              label: "Published",
              value: `${network.dataDirs.published} of ${network.dataDirs.total} data dirs`,
            },
          ]}
        />
        <p class="text-meta text-muted">
          Publishing writes a record to your repo and tells the AppView; records point to your
          files, never contain them.
        </p>
      </Section>

      <Section
        id="tokens"
        title="API tokens"
        description="For scripts and agents: send Authorization: Bearer <token> to the admin API, or to /mcp for its write tools. A token can do anything you can here except manage tokens."
      >
        {#if newToken}
          <Notice tone="success" title="Copy this token now. It won't be shown again.">
            <code class="data break-all select-all">{newToken}</code>
            {#snippet actions()}<Button size="sm" onclick={() => (newToken = null)}>Done</Button
              >{/snippet}
          </Notice>
        {/if}
        {#if tokens.length > 0}
          <div class="table-scroll">
            <table class="table">
              <thead>
                <tr>
                  <th>name</th><th>token</th><th>expires</th><th>last used</th><th
                    ><span class="sr-only">Actions</span></th
                  >
                </tr>
              </thead>
              <tbody>
                {#each tokens as t (t.id)}
                  <tr>
                    <td>{t.name}</td>
                    <td class="data nowrap">{t.prefix}…</td>
                    <td class="data nowrap">{formatDate(t.expiresAt)}</td>
                    <td class="data nowrap">{t.lastUsedAt ? formatDate(t.lastUsedAt) : "never"}</td>
                    <td class="num"
                      ><button class="underline" disabled={busy} onclick={() => revokeToken(t)}
                        >revoke</button
                      ></td
                    >
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
        <form
          class="flex flex-wrap items-end gap-2"
          onsubmit={(e) => {
            e.preventDefault();
            createToken();
          }}
        >
          <label class="grid flex-1 gap-1">
            <span class="text-meta">Name</span>
            <input class="input" bind:value={tokenName} placeholder="laptop script" required />
          </label>
          <label class="grid gap-1">
            <span class="text-meta">Expires in</span>
            <select class="input" bind:value={tokenDays}>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={365}>1 year</option>
            </select>
          </label>
          <Button type="submit" disabled={busy}>Create token</Button>
        </form>
      </Section>

      <Section id="storage" title="Storage">
        <MetaList
          rows={[
            { label: "Backend", value: "Cloudflare R2, in your own account" },
            { label: "In data dirs", value: formatBytes(network.storageBytes), mono: true },
          ]}
        />
      </Section>
    {/if}
  </div>
</div>
