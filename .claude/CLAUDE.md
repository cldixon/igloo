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

## Phase 1 (current work)

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
- **Published data files and license are immutable.** Title, description and
  README can be edited; each edit updates the record.

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
  `@cloudflare/workers-types`.
- `cf dev` evaluates the config with `--mode`. The instance binds the real R2
  bucket in dev unless the mode is `local` (`bun run dev --local`).
- **Bun** workspace with the isolated linker (`bunfig.toml`), so each package
  has its own `node_modules`; cf needs `wrangler` next to the package that
  declares it. `bun run check` at the root runs everything CI runs.
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

- `instance/`: the instance Worker (`@igloo/instance`), from iteration 2.
  - `src/worker.ts` entry; `src/api/` Hono app, routes, R2 storage, MCP;
    `src/shared/` types shared with the UI.
  - `web/`: SvelteKit SPA (`@igloo/instance-web`), built to `web/build` and
    served as static assets.
  - `scripts/`: `setup.ts` (writes `cloudflare.config.ts`) and `dev.ts`.
- `appview/`: the AppView Worker (`@igloo/appview`), at
  `igloo.cldixon.dev`.
- `packages/lexicon/`: `@igloo/lexicon`, NSIDs and record types shared by
  both Workers.
- `cli/`: Go CLI. `skills/igloo/`: agent skill.
