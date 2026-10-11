# igloo reference

The details behind the [README](../README.md): running an instance, its API and tools, and working on igloo itself.

## Running an instance

`bun create igloo my-igloo` makes a folder holding your settings and a dependency on `@igloo-data/instance`. In it:

| Command                                             | What it does                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------- |
| `bun run setup`                                     | Change the settings (re-run any time)                                 |
| `bun run deploy`                                    | Deploy. The first deploy also prints the setup code                   |
| `bun run dev`                                       | Run locally on http://127.0.0.1:8787 (`-- --local`: simulated bucket) |
| `bun run secrets`                                   | Replace the setup code and OAuth key (before claiming only)           |
| `bun update @igloo-data/instance && bun run deploy` | Update igloo. Migrations apply themselves                             |

The setup code claims the instance: the first AT Protocol account to sign in at `/admin` with it becomes the owner, and from then on only the owner can sign in. The instance asks your PDS only for write access to igloo records.

**Deploy on push (optional).** The folder's `.github/workflows/deploy.yml` deploys each push to `main` once the repo has the secret `CLOUDFLARE_API_TOKEN`: a Cloudflare API token from the "Edit Cloudflare Workers" template, plus D1 Edit. Without it, the workflow skips with a notice. CI never prints a setup code, since its logs may be public.

There are no preview deployments: previews share production's bucket and database, and migrations apply themselves, so a preview could change the real database. Try changes with `bun run dev -- --local`.

## Configuration

Each instance's settings live in its `igloo.config.json`. An environment variable overrides each one:

| Key        | Environment         | Description                                                        |
| ---------- | ------------------- | ------------------------------------------------------------------ |
| `worker`   | `IGLOO_WORKER`      | Worker name (default `igloo-instance`)                             |
| `bucket`   | `IGLOO_BUCKET`      | R2 bucket holding your data                                        |
| `database` | `IGLOO_DATABASE`    | D1 database for instance state (default: the Worker name)          |
| `domain`   | `IGLOO_DOMAIN`      | Custom domain, on a zone in your account; without one, workers.dev |
| `title`    | `IGLOO_TITLE`       | Site title                                                         |
| `tagline`  | `IGLOO_TAGLINE`     | Site tagline                                                       |
| `theme`    | `IGLOO_THEME`       | Default index view: `repo` (pretty) or `index` (classic)           |
| `appview`  | `IGLOO_APPVIEW_URL` | The AppView to notify after publishing (default the network's own) |

`IGLOO_CONFIG` points at a different file. A deploy with neither a config file nor `IGLOO_BUCKET` fails rather than deploying defaults. The only secrets are `SETUP_CODE` and `OAUTH_SIGNING_KEY`, which the first deploy sets.

## Data dirs

In the admin panel (`/admin`): create a data dir (its name is its folder in the bucket), add files (uploaded in 50 MB parts, or picked from files already in the folder), write a README, pick a license, and publish. Every file is hashed with sha256 from R2. Publishing writes a `dataDir` record to your repo and notifies the AppView.

While a data dir is published, its files and license are fixed, since the record's hashes point at them. Title, description, tags and README stay editable, and each save updates the record. Unpublishing deletes the record.

Files can also go into the bucket with any S3-compatible tool (`rclone copy ./my-dataset r2:my-bucket/my-dataset`) and be added from the admin panel.

## Querying and schemas

Published Parquet, CSV and JSON files get a **Query** panel on the instance and on the AppView. It runs [DuckDB-WASM](https://duckdb.org/docs/api/wasm/overview) in the browser and reads files from the instance with range requests, so a query over a large Parquet file downloads only what it needs.

Schemas and row counts are measured, never guessed: Parquet from its footer when it's added, CSV and JSON with DuckDB in the owner's browser (the **Measure** button). They go into the record, and the AppView searches them: `col:lat col:lon`, `type:date`, `tag:hydrology`.

## API

Reading is public. The admin API needs the owner's browser session or an **API token** (created in the admin panel, sent as `Authorization: Bearer igloo_…`). Tokens always expire, are stored only as hashes, and can do everything except manage tokens.

| Endpoint                         | Description                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| `GET /health`                    | Health check                                                                        |
| `GET /api/datadirs`              | Published data dirs: files, sha256, format, rows, schema, download URLs, record URI |
| `GET /api/datadirs/:name`        | One published data dir                                                              |
| `GET /api/list?path=`            | List directory contents                                                             |
| `GET`/`HEAD /api/download?path=` | Download a file. Supports `Range`                                                   |
| `GET /api/metadata?path=`        | File metadata (size, type, modified date, etag)                                     |
| `GET /api/config`                | Instance configuration                                                              |
| `/api/admin/*`                   | Admin API: data dirs, uploads, README, publish, drafts                              |
| `POST /mcp`                      | MCP endpoint (streamable HTTP, stateless)                                           |

## Agents

- **MCP** at `POST /mcp`. Anyone gets read tools: `igloo_list_datadirs`, `igloo_get_datadir`, `igloo_list`, `igloo_metadata`, `igloo_read_file`, `igloo_health` and `igloo_config`. With an API token it adds tools to create, describe, fill, publish and unpublish data dirs.
- **Agent skill** in [`skills/igloo/`](../skills/igloo/), which teaches agents to browse and fetch datasets through the CLI.

## CLI

```bash
cd cli && go build -o igloo .
./igloo connect https://data.example.com
./igloo ls [path]            # browse directories
./igloo get <path> [-o dir]  # download a file
./igloo info <path>          # file metadata
```

The target instance comes from `--url`, then `IGLOO_API_URL`, then `~/.igloo/config.yaml`.

## Web UI

Both the instance and the AppView are built from `@igloo/ui` (`packages/ui`), one design system of tokens and Svelte components, so a data dir looks the same in either place.

- **Instance, public:** `/` lists the published data dirs (a pretty table, or `?view=classic` for a plain `Index of /` listing); `/<name>` is a data dir, with tabs for files, README, schema, query and record (`?tab=`).
- **Instance, admin:** `/admin` signs in (or claims a new instance with its setup code) and lists data dirs; `/admin/new`, then `/admin/d/<name>` steps through files, details and review to publish; `/admin/settings` has the instance profile, owner, network, API tokens and storage.
- **AppView:** `/` is the feed (with `/discover` and `/search` as tabs), `/d/<did>/<name>` a data dir, `/i/<did>/<host>` an instance, `/instances` every instance, `/m/<did>` a maintainer, `/deploy` how to run your own.

## Developing igloo

```bash
git clone https://github.com/cldixon/igloo.git && cd igloo
bun install
bun run check                          # everything CI runs
cd instance && bun run dev --local     # instance on :8787, UI on :5173, simulated bucket
```

For a development instance against real resources, `bun run setup` in `instance/` writes a gitignored `instance/igloo.config.json`, and `bun run deploy` there builds from source.

CI (`.github/workflows/ci.yml`) runs the checks on pull requests and on `main`. `deploy-appview.yml` deploys the AppView from `main` using the repo secret `CLOUDFLARE_API_TOKEN` (the "Edit Cloudflare Workers" template plus D1 Edit and Queues Edit).

Built with [Cloudflare Workers](https://workers.cloudflare.com), [Hono](https://hono.dev), [R2](https://developers.cloudflare.com/r2/), [D1](https://developers.cloudflare.com/d1/), [SvelteKit](https://svelte.dev), [Go](https://go.dev) and [Bun](https://bun.sh), deployed with [cf](https://www.npmjs.com/package/cf), the Cloudflare CLI.

## Releasing

`bun run --cwd instance pack` builds `@igloo-data/instance` (the prebuilt Worker bundle, the UI, `defineIgloo` and the `igloo` CLI) and `create-igloo` into `instance/dist/`, both at `instance/package.json`'s version. To release, bump that version, merge, and push a matching tag:

```bash
git tag v0.1.0 && git push origin v0.1.0
```

`.github/workflows/release.yml` publishes both to npm with [trusted publishing](https://docs.npmjs.com/trusted-publishers) (no token; npm adds provenance) and attaches the tarballs to a GitHub release.
