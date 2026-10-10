# ❄ igloo

**Personal, self-hosted data spaces, joined by AT Protocol.**

Everyone hosts their own data directories on Cloudflare. A shared AppView lets people find them. It's a modern take on the directory-listing servers that early ML research shared datasets from, plus decentralized identity and an API agents can use.

igloo is three parts:

- **An instance** you deploy into your own Cloudflare account. Files live in your R2 bucket as plain files. A Worker serves an AutoIndex-style public listing, an admin panel, file downloads, a REST API and an MCP endpoint. The unit of content is a **data dir**: a folder of data files, a README and a license, each file hashed with sha256.
- **A lexicon.** Publishing a data dir writes a small `dataDir` record to your AT Protocol repo (your PDS). The record lists the files and their hashes and points at your instance; it never contains the data.
- **An AppView** that reads igloo records from the network and shows a feed of recent publishes, with pages for each data dir, instance and maintainer. It never stores or proxies data files.

The full design is in the [igloo Network Design](https://claude.ai/artifact/HMW8j1kyFnSLYmxThUVDPz) handoff. This is **phase 1**, an end-to-end prototype: records use the `dev.cldixon.igloo.*` namespace and the AppView runs at `igloo.cldixon.dev`. Both move to `social.igloo.*` / `igloo.social` at the end of the phase.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cldixon/igloo/tree/main/instance)

The button deploys an instance into your account. To set one up by hand, follow the Quick Start below. [docs/runbook.md](docs/runbook.md) covers deploying the AppView and testing the whole network.

## Architecture

```
  owner's Cloudflare account              owner's PDS             project
 ┌────────────────────────────┐       ┌──────────────┐
 │ instance Worker (Hono)     │ OAuth │ dataDir and  │  Jetstream  ┌──────────────────────┐
 │  public listing · admin    │──────▶│ instance     │────────────▶│ AppView Worker        │
 │  REST API · MCP · downloads│ write │ records      │             │  JetstreamDO → Queue  │
 │ R2: <data dir>/<files>     │       └──────────────┘   re-fetch  │  → index in D1        │
 │ D1: data dirs, hashes,     │◀── notifyRecord (hint) ────────────│  feed and pages       │
 │     sessions, settings     │                                    └──────────────────────┘
 └────────────────────────────┘
          ▲ files, straight from R2 via the instance
          └──────────── browsers and agents
```

The repo is a Bun workspace:

| Path                | What                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `instance/`         | The instance Worker and its SvelteKit UI (`instance/web`)                                  |
| `appview/`          | The AppView Worker                                                                         |
| `packages/lexicon`  | Record schemas, validation and NSIDs, shared by both                                       |
| `packages/platform` | Shared Worker plumbing: D1 migrations, AT Protocol identity, XRPC, OAuth, browser sessions |
| `cli/`              | Go CLI                                                                                     |
| `skills/igloo/`     | Agent skill                                                                                |

## Quick Start

### Prerequisites

- [Bun](https://bun.sh)
- A [Cloudflare](https://cloudflare.com) account
- [Go](https://go.dev) 1.23+ (only if you want to build the CLI)

### 1. Clone and install

```bash
git clone https://github.com/cldixon/igloo.git
cd igloo
bun install
cd instance
```

The repo is a Bun workspace. The instance Worker and its UI live in `instance/`; the commands below run from there.

### 2. Authenticate and provision

```bash
bunx cf auth login
bun run setup
```

`bun run setup` asks for your Worker name, bucket name, site title and domain. It creates the R2 bucket if it doesn't exist, sets CORS on it, and writes your answers to `igloo.config.json`. That file is your instance's only configuration; git ignores it, so pulling new igloo versions never conflicts with it. Keep it (or its values) somewhere safe: every deploy reads it. Re-running `setup` offers your current answers as defaults. The D1 database (named after the Worker) is created by the first deploy, and its schema migrates itself.

### 3. Run locally

```bash
bun run dev
```

This starts `cf dev` on port 8787 (the Worker, bound to your real R2 bucket) and Vite on port 5173 (the UI, with HMR). Open http://localhost:5173.

Pass `--local` to use a simulated R2 instead of the live bucket:

```bash
bun run dev --local
```

### 4. Deploy and claim

```bash
bun run deploy
bun run secrets
```

`bun run deploy` builds the web UI and deploys the Worker. `bun run secrets` sets two secrets on it and prints the setup code:

- `SETUP_CODE`: the one-time code that claims the instance.
- `OAUTH_SIGNING_KEY`: the key the instance signs its OAuth requests with.

Both are optional. Without them the instance generates its own on first use, keeps them in D1, and writes the setup code to the Worker's logs.

Then open `/admin` on your instance and sign in with your AT Protocol handle (Bluesky or any PDS) and the setup code. That account becomes the owner; the code stops working, and from then on only the owner can sign in. The instance asks your PDS only for write access to igloo records.

The custom domain must be on a zone in your own Cloudflare account, or the deploy will fail. Answer the domain prompt with a blank line to serve from `*.workers.dev` instead: with a domain, the custom domain is the only way in; without one, `workers.dev` is turned on so the Worker still has a route.

To update later, pull the new version and run `bun run deploy` again. Migrations apply themselves on first request.

## Continuous Deployment

GitHub Actions (`.github/workflows/ci.yml`) runs every quality check on pull requests and on `main`: format, type check, `svelte-check`, tests, build, and `cf deploy --dry-run` against `instance/igloo.config.example.json`. Deploying is [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)' job, so builds use Cloudflare's minutes rather than GitHub's.

To deploy your instance on every push to `main`, connect your Worker in the Cloudflare dashboard (**Settings** → **Build**):

1. Connect your GitHub repository (your fork, or the repo you deploy from).
2. Root directory: `instance`.
3. Build command: `bun install && bun run build`. Deploy command: `bunx cf deploy`.
4. **Build variables:** your `igloo.config.json` isn't in the repo, so give the build its values instead: `IGLOO_BUCKET` and, if you have them, `IGLOO_DOMAIN`, `IGLOO_WORKER` (default `igloo`), `IGLOO_TITLE`, `IGLOO_TAGLINE`. A build with neither the file nor `IGLOO_BUCKET` fails rather than deploying defaults.
5. Leave **non-production branch builds** off.

The instance has no preview deployments (`previewUrls: false`). Preview versions share production's bucket and database, and migrations apply themselves on first request, so a preview of a branch with a new migration would change the real database before the branch merged. Try changes locally with `bun run dev --local`.

The AppView is connected the same way with root directory `appview`, build command `bun install`, deploy command `bunx cf deploy`, and non-production branch builds off. Workers with Durable Objects get no preview URLs, and it has one (`JetstreamDO`).

## Adding Data

In the admin panel (`/admin`):

1. **Create a data dir.** Its name is its folder in the bucket. Folders already in the bucket appear as one-click options.
2. **Add files.** Upload them (large files go up in 50 MB parts), or add files already in the folder. Every file is hashed with sha256 from R2 after upload.
3. **Write the README and pick a license.**
4. **Publish.** The instance writes a `dataDir` record to your repo and tells the AppView, so it appears on the feed within seconds.

While a data dir is published its files and license are fixed, since the record's hashes point at them. Title, description and README stay editable, and each save updates the record. Unpublishing deletes the record and makes the data dir editable again.

You can still copy files into the bucket with any S3-compatible tool and add them from the admin panel:

```bash
rclone copy ./my-dataset r2:my-bucket/my-dataset
```

## Configuration

Each instance's settings live in `instance/igloo.config.json` (written by `bun run setup`, ignored by git). An environment variable overrides each one, for CI and Workers Builds:

| Key        | Environment         | Description                                                        |
| ---------- | ------------------- | ------------------------------------------------------------------ |
| `worker`   | `IGLOO_WORKER`      | Worker name (default `igloo`)                                      |
| `bucket`   | `IGLOO_BUCKET`      | R2 bucket holding your data                                        |
| `database` | `IGLOO_DATABASE`    | D1 database for instance state (default: the Worker name)          |
| `domain`   | `IGLOO_DOMAIN`      | Custom domain, on a zone in your account; without one, workers.dev |
| `title`    | `IGLOO_TITLE`       | Site title                                                         |
| `tagline`  | `IGLOO_TAGLINE`     | Site tagline                                                       |
| `theme`    | `IGLOO_THEME`       | Default visual theme (`repo` or `index`)                           |
| `appview`  | `IGLOO_APPVIEW_URL` | The AppView to notify after publishing (default the network's own) |

`IGLOO_CONFIG` points at a different file. `instance/cloudflare.config.ts` turns these into the Worker's config and holds nothing specific to one instance.

The R2 and D1 bindings authenticate through your Cloudflare account. The only secrets are the optional `SETUP_CODE` and `OAUTH_SIGNING_KEY` (see [Deploy and claim](#4-deploy-and-claim)).

## API

Reading is public. Writing (the admin API) needs the owner's browser session or an **API token**: create one in the admin panel and send it as `Authorization: Bearer igloo_…`. Tokens always expire, are stored only as hashes, and can do everything except manage tokens.

| Endpoint                         | Description                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| `GET /health`                    | Health check                                                                        |
| `GET /api/datadirs`              | Published data dirs: files, sha256, format, rows, schema, download URLs, record URI |
| `GET /api/datadirs/:name`        | One published data dir                                                              |
| `GET /api/list?path=`            | List directory contents (files, subdirectories, README)                             |
| `GET`/`HEAD /api/download?path=` | Download a file. Supports `Range`, so Parquet can be read selectively               |
| `GET /api/metadata?path=`        | File metadata (size, type, modified date, etag)                                     |
| `GET /api/config`                | Instance configuration                                                              |
| `/api/admin/*`                   | Admin API: data dirs, uploads, README, publish, drafts (session or token)           |
| `POST /mcp`                      | MCP endpoint (streamable HTTP, stateless)                                           |

See [`skills/igloo/references/api.md`](skills/igloo/references/api.md) for the original file API's request/response documentation.

## Querying

Published data dirs with Parquet, CSV or JSON files get a **Query** panel, on the instance's own listing and on the AppView. It runs [DuckDB-WASM](https://duckdb.org/docs/api/wasm/overview) in the browser, reading files straight from the instance with range requests, so a query over a large Parquet file downloads only the columns and row groups it needs. No igloo server does any compute.

Each data file's schema and row count are measured, not guessed: Parquet from its footer when it's added, CSV and JSON with DuckDB in the owner's browser (the **Measure** button). They go into the record, and the AppView can search on them: `col:lat col:lon`, `type:date`, `tag:hydrology`.

## CLI

The CLI is built with [Cobra](https://github.com/spf13/cobra) and styled with [Charm](https://charm.sh) libraries (Lip Gloss, Glamour) for a polished terminal experience.

```bash
cd cli && go build -o igloo .

./igloo connect https://data.example.com
./igloo ls [path]           # Browse directories (tree-style output)
./igloo get <path> [-o dir] # Download a file
./igloo info <path>         # Show file metadata
./igloo health              # Check API connectivity
```

The CLI resolves the target instance with this precedence: `--url` flag > `IGLOO_API_URL` env var > `~/.igloo/config.yaml`.

## Agent Access

Igloo exposes two agent-facing interfaces over the same data:

- **MCP server** at `POST /mcp`. Anyone gets read tools: `igloo_list_datadirs` and `igloo_get_datadir` (files, hashes, schemas, download URLs), plus `igloo_list`, `igloo_metadata`, `igloo_read_file`, `igloo_health` and `igloo_config`. With an API token (`Authorization: Bearer igloo_…`), it adds tools to create, describe, fill, publish and unpublish data dirs.
- **Agent skill** in [`skills/igloo/`](skills/igloo/) — teaches LLM agents to browse and retrieve datasets through the CLI.

## Web UI

The web interface provides a directory browser modeled after classic server index pages — updated with a modern, monospace-driven design. Features include breadcrumb navigation, file type icons, inline README rendering, and a light/dark mode toggle.

### Appearance

The UI ships with two visual themes and a light/dark mode toggle, all accessible from the settings menu (gear icon) in the top-right corner:

| Theme     | Description                                                                                                           |
| --------- | --------------------------------------------------------------------------------------------------------------------- |
| **Repo**  | Card-based layout with rounded corners, JetBrains Mono + Inter fonts, and a modern repository feel                    |
| **Index** | Classic Apache `mod_autoindex` directory listing — monospace table, `[DIR]`/`[   ]` markers, "Index of /path" heading |

Users can override the theme and color mode in-browser via the settings menu — preferences are saved to `localStorage`.

## Tech Stack

| Component | Technology                                                                                 |
| --------- | ------------------------------------------------------------------------------------------ |
| Runtime   | [Cloudflare Workers](https://workers.cloudflare.com)                                       |
| API       | [Hono](https://hono.dev)                                                                   |
| Storage   | [Cloudflare R2](https://developers.cloudflare.com/r2/)                                     |
| Web UI    | [SvelteKit](https://svelte.dev) + Svelte 5 (SPA, served via Workers Static Assets)         |
| CLI       | [Go](https://go.dev) + [Cobra](https://github.com/spf13/cobra) + [Charm](https://charm.sh) |
| Tooling   | [Bun](https://bun.sh) + [cf](https://www.npmjs.com/package/cf), the Cloudflare CLI         |

## License

MIT
