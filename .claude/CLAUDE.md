# igloo — development notes

## Source of truth

The design is the **igloo Network Design** artifact (handoff v0.2, Oct 2026):
https://claude.ai/artifact/HMW8j1kyFnSLYmxThUVDPz

Read it before making architectural decisions. Where this file and the artifact
disagree, the artifact wins. Update this file when that happens.

## What igloo is

A network of personal, self-hosted data spaces, joined by AT Protocol. Three
parts:

1. **Instance**: deployed by each owner into their own Cloudflare account.
   R2 holds data files, D1 holds instance state, and a Worker (Hono) serves an
   AutoIndex-style public listing, an admin panel and file downloads. The unit
   of content is a **data dir**: one or more data files, a README and a
   license, each file hashed with sha256.
2. **Lexicon**: publishing a data dir writes a `dataDir` record to the
   owner's PDS. Records describe and point to data; they never contain it.
3. **AppView**: reads igloo records from Jetstream (plus `notifyRecord` hints
   from instances), re-fetches each record from its PDS, indexes into D1 and
   serves a feed with data dir, instance and maintainer pages. It never stores
   or proxies data files.

## History

This is the third iteration. Ignore anything describing the earlier ones.

1. Railway + Bun, single-user MVP. Gone.
2. Single Cloudflare Worker serving a REST API, SvelteKit UI, MCP endpoint and
   Go CLI over one R2 bucket. This is the code currently in the repo, deployed
   as the `igloo` Worker at `data.cldixon.dev` (bucket `data-repo`).
3. The networked design in the artifact. Iteration 2 becomes the starting
   point for the **instance**; the AppView is new.

## Status

- **Phase 1** is implemented; deploy and end-to-end testing next. Steps,
  and what hasn't been verified against the live network:
  `docs/runbook.md`.
- **Phase 2** ("Using the data") is built ahead of the reset, under the
  phase 1 names: measured schemas, in-browser DuckDB queries, the REST API,
  API tokens, MCP data dir tools, AppView search and AI drafts. Its
  checklist is in the runbook too. Not done yet: the AppView's discovery MCP,
  and MCP over OAuth 2.1 (tokens stand in for now).

## Phase 1

End-to-end prototype across all three layers. Prototype names:

- Lexicon namespace: `dev.cldixon.igloo.*` (`dataDir`, `instance`, plus the
  `notifyRecord` XRPC method)
- AppView: `igloo.cldixon.dev`
- Reference instance: `data.cldixon.dev`

Everything published in phase 1 is wiped at the reset point, when the network
moves to `social.igloo.*` / `igloo.social`. Until then, lexicon shapes can
change freely.

In scope: one-click deploy (R2, D1, Worker, CORS, OAuth keys, setup code,
custom domain); AT Protocol OAuth as the only sign-in, with a one-time setup
code to claim ownership; data dirs with per-file sha256; publish, edit
metadata/README and unpublish; instance record; notify the AppView; AppView
Jetstream ingestion, queue, re-fetch, daily reconcile, feed and pages.

Out of scope for phase 1: schema/querying, API and MCP work, mirrors,
citations, likes, private data, versions, updates. The existing REST API, MCP
endpoint and CLI stay in place but aren't extended in phase 1.

## Architecture decisions

- **Two Workers.** The instance Worker and the AppView Worker are separate
  deployables.
- **Durable Objects only in the AppView.** The AppView uses a singleton
  `JetstreamDO` to hold the WebSocket. The instance Worker uses no Durable
  Objects.
- **Records are triggers, PDS is truth.** Jetstream events and notify calls
  only trigger a re-fetch from the author's PDS; nothing is indexed straight
  from an event.
- **OAuth sessions and DPoP nonces live in storage (D1/KV)**, never in memory.
- **No secrets in records**, ever.
- **D1 migrations apply themselves** on first use per isolate
  (`packages/platform/src/migrate.ts`); owners never run a migration command.
  Never edit a shipped migration, and only add: Worker versions roll back,
  D1 doesn't.
- **Published data files and license are immutable.** Title, description,
  tags, README and measured file profiles can change; each change updates
  the record.
- **Schemas are measured, never guessed.** Parquet is profiled server-side
  from its footer (hyparquet, range reads); CSV/JSON in the owner's browser
  with DuckDB. AI only drafts prose (Workers AI), which the owner reviews.
- **No igloo server computes queries.** DuckDB-WASM in the browser reads
  files from the instance with range requests (`/api/download` supports HEAD
  and `Range`).

## Tooling

- **Use the `cf` CLI, not `wrangler`.** `cf` is Cloudflare's new CLI and is
  the direction for this project. Discover commands with
  `cf cli search "<what you want to do>"` (keep queries generic: no names,
  domains, IDs or tokens), then `<command> --help`. Don't explore by chaining
  `--help` calls.
- Each Worker is configured in its own `cloudflare.config.ts` (`cf/config`).
  The instance also has a small `wrangler.config.ts` for the assets
  directory, because cf still bundles through Wrangler. `cf workers types`
  generates `.cloudflare/types/index.d.ts` (Env plus runtime types); each
  package's `typecheck` script runs it first. Don't add
  `@cloudflare/workers-types` to the Workers; only `packages/platform`, which
  has no config of its own, uses it for its typecheck.
- `cf dev` evaluates the config with `--mode`. The instance binds the real R2
  bucket in dev unless the mode is `local` (`bun run dev --local`).
- **Bun** workspace with the isolated linker (`bunfig.toml`), so each package
  has its own `node_modules`; cf needs `wrangler` next to the package that
  declares it. `bun run check` at the root runs everything CI runs.
- Tests that need D1 or R2 use real local bindings through Miniflare 4
  (`@igloo/platform/testing`). Wrangler bundles its own Miniflare 5 alpha;
  don't use that one in tests. Test DIDs must be valid (`did:plc:` + 24
  base32 characters, `a-z2-7`), or URI parsing rightly rejects them.
- **Prettier** for formatting (`bun run format`). CI runs `format:check`.
- SvelteKit (Svelte 5) for the web UI under `instance/web/`; Go for the CLI under
  `cli/`.

## Workflow

- **Conserve GitHub Actions minutes.** Do as much work as possible on one
  branch and push in batches rather than after every small change. Run the
  checks CI runs (format, typecheck, svelte-check, tests, build) locally
  before pushing.
- Commit history doesn't need to be tidy.

## Repo layout

- `instance/`: the instance Worker (`@igloo/instance`).
  - `src/worker.ts` entry; `src/api/app.ts` mounts the routes.
  - `src/api/routes/`: public listing, download, metadata, config (from
    iteration 2), `auth.ts` (OAuth client docs, sign-in, setup-code claim),
    `admin.ts` (owner-only admin API: data dirs, uploads, publish, tokens,
    drafts), `datadirs.ts` (public data dir API). `src/api/mcp.ts`: MCP, with
    write tools when the request carries an API token.
  - `src/api/session.ts`: browser session cookie and the `requireOwner` guard.
  - `src/auth/`: owner and setup code, the instance's OAuth client, API
    tokens (`tokens.ts`).
  - `src/admin/`: R2 hashing and upload helpers, Parquet profiling
    (`profile.ts`), AI drafts (`draft.ts`), PDS writes, AppView notify.
  - `src/db/`: D1 migrations and the data dir store (publish rules live here).
  - `src/records.ts`: data dir → validated `dataDir` record.
  - `src/shared/`: types shared with the UI.
  - `web/`: SvelteKit SPA (`@igloo/instance-web`); `/admin` is the admin panel.
  - `scripts/`: `setup.ts` (config, bucket, CORS), `secrets.ts` (setup code
    and OAuth key as Worker secrets), `dev.ts`.
- `appview/`: the AppView Worker (`@igloo/appview`), at `igloo.cldixon.dev`.
  - `src/index.ts`: routes, `notifyRecord`, operator `/admin/*` (needs the
    `ADMIN_TOKEN` secret), queue and cron handlers.
  - `src/indexer.ts`: re-fetch a record from its PDS, validate, index.
  - `src/jetstream.ts`: `JetstreamDO`. `src/reconcile.ts`: daily rebuild.
  - `src/views.ts`: server-rendered pages (escape everything; records are
    untrusted). `src/auth.ts`: viewer sign-in (identity only).
- `packages/lexicon/`: `@igloo/lexicon`, NSIDs, record schemas (zod) and
  validation, AT URIs. `lexicons/` has the same records as Lexicon JSON, for
  publishing at the reset; a test keeps the two in step.
- `packages/query/`: `@igloo/query`, the DuckDB-WASM loader, `measureFile`
  and the query panel, shared by both UIs. `loadDuckDB`, `mountQueryPanel`
  and `measureFile` must stay self-contained (no module-scope references):
  the AppView ships them with `toString()`. `types.d.ts` declares the API
  without DOM types so Workers can import it.
- `packages/platform/`: `@igloo/platform`, shared Worker plumbing: D1
  migrations, settings, DID resolution, XRPC, OAuth (D1 stores, refresh
  lock, loopback client in dev), browser sessions. `./testing` has real
  local D1/R2 bindings for tests.
- `cli/`: Go CLI. `skills/igloo/`: agent skill.

## Local development notes

- Dev servers: instance on `127.0.0.1:8787`, AppView on `127.0.0.1:8788`
  (pinned in each `wrangler.config.ts`, so requests keep their loopback
  origin instead of being rewritten to the custom domain).
- OAuth sign-in only works locally on `http://127.0.0.1:<port>` (AT Protocol
  loopback clients), not `localhost` or the Vite port.
- Bun can't load `cloudflare:workers`; tests that import the AppView entry
  stub it with `mock.module`.
- Don't `pkill -f` with a pattern that also matches your own shell command.
  Use `pgrep -x workerd` to stop dev servers.
