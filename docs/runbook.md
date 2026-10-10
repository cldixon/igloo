# Runbook: deploy and test the network

Phase 1 is done when, across three instances and three AT Protocol test accounts:

1. A publish on any instance appears on the feed within seconds.
2. Metadata edits and unpublishes propagate.
3. Wiping the AppView index and running reconcile rebuilds the same feed.
4. A downloaded file matches the hash in its record.

Everything below uses the `cf` CLI (`bunx cf …` from a package directory). Run `bun install` at the repo root first.

## 0. Before you start

- **Three AT Protocol accounts** for testing (Bluesky accounts work). One owns each instance.
- **Network access**, if running from a Claude cloud session: the session's environment needs these hosts allowed:
  - `*.cldixon.dev` (the instances and the AppView)
  - `plc.directory` (DID resolution)
  - `bsky.social` and `*.bsky.network` (PDSes, the relay, Jetstream)
  - `public.api.bsky.app` (profiles)
  - `cloudflare-dns.com` (handle resolution)

## 1. Deploy the AppView

```bash
cd appview
bunx cf deploy
```

The first deploy should create the `igloo-appview` D1 database and the `igloo-appview-index` queue (`cf deploy` provisions bindings by default), and attach `igloo.cldixon.dev`. If it complains about the queue, create it and deploy again:

```bash
bunx cf queues create --queue-name igloo-appview-index
```

Set an operator token. It enables `/admin/reconcile` and `/admin/jetstream`:

```bash
TOKEN=$(openssl rand -hex 24)
bunx cf workers secrets update ADMIN_TOKEN --worker igloo-appview --type secret_text --text "$TOKEN"
```

Start the Jetstream connection now, rather than waiting for the 5-minute cron:

```bash
curl -H "Authorization: Bearer $TOKEN" https://igloo.cldixon.dev/admin/jetstream
# {"connected":true,"cursor":…,"lastEventAt":null}
```

For deploys on push, connect the `igloo-appview` Worker to the repo in Workers Builds with root directory `appview`, build command `bun install`, deploy command `bunx cf deploy`, and non-production branch builds off.

## 2. Deploy the reference instance (data.cldixon.dev)

Its settings are in `instance/igloo.config.json`, which isn't in the repo: keep a copy, or recreate it with `bun run setup` (worker `igloo`, bucket `data-repo`, domain `data.cldixon.dev`). For Workers Builds, set the build variables `IGLOO_BUCKET=data-repo` and `IGLOO_DOMAIN=data.cldixon.dev` on the `igloo` Worker, and turn its non-production branch builds off. To deploy by hand:

```bash
cd instance
bunx cf r2 buckets cors update data-repo --force --rules '[{"allowed":{"origins":["*"],"methods":["GET","HEAD"],"headers":["Range"]},"exposeHeaders":["Content-Range","Content-Length","ETag"],"maxAgeSeconds":3600}]'
bun run deploy
bun run secrets        # prints the setup code
```

Open <https://data.cldixon.dev/admin>, sign in with test account 1 and the setup code. Then, in the admin panel:

1. Save the **instance profile**. This publishes the instance record.
2. Turn one of the existing folders (`usbr`, `in-our-time`, `cspan-booknotes`) into a data dir: click it under "Folders in the bucket", then **Add all** to hash its files.
3. Add a README and a license, then **Publish**.

## 3. Deploy two more instances

Each instance needs its own Worker, bucket, database and domain. Give each its own config file; `IGLOO_CONFIG` picks which one a command uses:

```bash
cd instance
export IGLOO_CONFIG=igloo-2.config.json
bun run setup     # worker igloo-2, bucket igloo-2, domain igloo-2.cldixon.dev
bun run deploy
bun run secrets
unset IGLOO_CONFIG
```

Repeat with `igloo-3`. Claim each with a different test account, then publish a data dir from each.

## 4. Check the done criteria

**1. Publish to feed in seconds.** Publish on any instance and reload <https://igloo.cldixon.dev>. The instance's notify call queues the record, and Jetstream delivers the same event shortly after. To test the Jetstream path alone, set `IGLOO_APPVIEW_URL` on one instance to an unused URL. Its publishes should still appear, a few seconds later. `/admin/jetstream` shows `lastEventAt`.

**2. Edits and unpublishes propagate.** Change a title or the README of a published data dir: the feed and the data dir page update. Unpublish: it leaves the feed.

**3. Wipe and reconcile.** Note the feed, then empty the index and rebuild it:

```bash
cd appview
bunx cf d1 list                     # find the igloo-appview database ID
bunx cf d1 query <database-id> --sql "DELETE FROM data_dirs; DELETE FROM instances; DELETE FROM maintainers;"
curl -X POST -H "Authorization: Bearer $TOKEN" https://igloo.cldixon.dev/admin/reconcile
# {"repos":3,"records":…,"stale":0,"failedRepos":[]}
```

Reload the feed after a few seconds; it should match. Reconcile also runs daily at 04:17 UTC.

**4. Hashes match.** On a data dir page, download a file and compare:

```bash
curl -sL "https://data.cldixon.dev/api/download?path=<data dir>/<file>" | sha256sum
```

The README panel on the data dir page runs the same check in the browser.

## Local development

```bash
cd instance && bun run dev --local   # instance on 127.0.0.1:8787, UI on :5173
cd appview && bunx cf dev            # AppView on 127.0.0.1:8788
```

Sign-in works locally through AT Protocol loopback clients, but only on `http://127.0.0.1:<port>`, not `localhost` and not the Vite port. To try the admin panel locally, run `bun run build` in `instance`, then open <http://127.0.0.1:8787/admin>.

A local instance publishes real records, pointing at `http://127.0.0.1:8787`, and notifies the AppView in `IGLOO_APPVIEW_URL`. Use a test account.

## Not yet verified against the live network

These were built to the specs and tested with fakes, but this session couldn't reach the network:

- **OAuth scopes.** The instance requests `atproto repo:dev.cldixon.igloo.dataDir repo:dev.cldixon.igloo.instance`, so it can write igloo records and nothing else. If a PDS rejects those granular scopes at sign-in, change `OAUTH_SCOPE` in `instance/src/auth/client.ts` to `atproto transition:generic`.
- **Provisioning.** That `cf deploy` creates the D1 databases and the queue on first deploy.
- **Jetstream.** The Durable Object's outbound WebSocket in production: how long it stays up, and whether the 30 s alarm and 5-minute cron reconnect it reliably.

## Phase 2 checks (built ahead, under the phase 1 names)

Phase 2 deploys the same way, and its migrations (instance `0002`/`0003`, AppView `0002_search`) apply themselves. The instance now also binds **Workers AI** (`AI`), which `cf deploy` should attach with no setup.

Browsers running the query panel load DuckDB-WASM from `cdn.jsdelivr.net`, and DuckDB fetches its Parquet extension from `extensions.duckdb.org`.

1. **Measured schemas.** Upload a Parquet file: its row count and columns show up straight away (read from the footer). Click **Measure** on a CSV: DuckDB runs in your browser and fills them in.
2. **Query.** On a published data dir (the instance listing, and the AppView page), run SQL against a Parquet file. In the browser's network tab, the instance should answer `206 Partial Content` for small ranges rather than sending the whole file.
3. **Search.** On the AppView, try `col:<a column>`, `type:double`, `tag:<a tag>`, and plain words. `/api/search?q=…` returns the same as JSON.
4. **API tokens.** Create one in the admin panel, then:
   ```bash
   curl -H "Authorization: Bearer $IGLOO_TOKEN" https://data.cldixon.dev/api/admin/datadirs
   curl https://data.cldixon.dev/api/datadirs
   ```
5. **MCP.** Point an MCP client at `https://data.cldixon.dev/mcp`. Without a token it gets read tools. With `Authorization: Bearer $IGLOO_TOKEN` it can also create, describe and publish data dirs.
6. **AI drafts.** In a data dir's editor, click **Draft with AI**, review what it fills in, and save what you keep.

Verified live (Oct 2026): Parquet and CSV queries on the AppView read byte ranges (a `count(*)` on a 22.6 MB Parquet file fetches only its 7.9 KB footer), anonymous MCP lists only the read tools, the public data dir API, plain-word search, and 401s from the admin API without a valid token. DuckDB-WASM 1.32 downloads whole files over HTTP by default; `loadDuckDB` turns that off with `forceFullHTTPReads: false`.

Not yet verified live: Measure on a CSV, `col:`/`type:`/`tag:` search (needs measured files and tags), API tokens and MCP write tools, Workers AI's draft quality, and footer profiling on large real-world Parquet files.
