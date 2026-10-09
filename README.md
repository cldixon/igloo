# ❄ igloo

**Personal, self-hosted data spaces, joined by AT Protocol.**

Everyone hosts their own data directories on Cloudflare. A shared AppView lets people find them. It's a modern take on the directory-listing servers that early ML research shared datasets from, plus decentralized identity and an API agents can use.

igloo is three parts:

- **An instance** you deploy into your own Cloudflare account. Files live in your R2 bucket as plain files. A Worker serves an AutoIndex-style public listing, an admin panel, file downloads, a REST API and an MCP endpoint. The unit of content is a **data dir**: a folder of data files, a README and a license, each file hashed with sha256.
- **A lexicon.** Publishing a data dir writes a small `dataDir` record to your AT Protocol repo (your PDS). The record lists the files and their hashes and points at your instance; it never contains the data.
- **An AppView** that reads igloo records from the network and shows a feed of recent publishes, with pages for each data dir, instance and maintainer. It never stores or proxies data files.

The full design is in the [igloo Network Design](https://claude.ai/artifact/HMW8j1kyFnSLYmxThUVDPz) handoff. This is **phase 1**, an end-to-end prototype: records use the `dev.cldixon.igloo.*` namespace and the AppView runs at `igloo.cldixon.dev`. Both move to `social.igloo.*` / `igloo.social` at the end of the phase.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cldixon/igloo/tree/main/instance)

The button deploys an instance into your account. To set one up by hand, follow the Quick Start below. [docs/phase1-runbook.md](docs/phase1-runbook.md) covers deploying the AppView and testing the whole network.

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

`bun run setup` asks for your Worker name, bucket name, site title and domain. It creates the R2 bucket if it doesn't exist, sets CORS on it, and writes your answers into `cloudflare.config.ts`. The D1 database (named after the Worker) is created by the first deploy, and its schema migrates itself.

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

`bun run setup` writes your custom domain into `cloudflare.config.ts`. The zone must be on your own Cloudflare account, or the deploy will fail:

```ts
domains: ["data.example.com"],
```

Answer the domain prompt with a blank line to drop the domain and serve from `*.workers.dev` instead. `setup` keeps the two in step: giving a domain sets `workersDev` to `false` so the custom domain is the only way in, and leaving it blank sets it to `true` so the Worker still has a route.

## Continuous Deployment

An instance deploys as a **single Worker** (the API and the web UI ship together), so [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) handles the whole pipeline natively. The AppView is a second Worker connected the same way, with root directory `appview`.

The two systems have separate jobs, and neither does the other's work:

| System                                          | Responsibility                                                                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GitHub Actions** (`.github/workflows/ci.yml`) | Every quality check. Workers: type check, `svelte-check`, tests, build, and `cf deploy --dry-run` to validate each config. CLI: `gofmt`, `go vet`, `go test`. |
| **Workers Builds**                              | Building and deploying only                                                                                                                                   |

Connect the repo once:

1. In the Cloudflare dashboard, open your Worker → **Settings** → **Build**.
2. Connect your GitHub repository.
3. Set the root directory to `instance`.
4. Set the build command to `bun install && bun run build`.
5. Set the deploy command to `bunx cf deploy`, and the non-production branch deploy command to `bunx cf previews deploy`.
6. Under **Branch control**, enable **non-production branch builds** (off by default — this is what produces the PR previews).

You then get:

| Event                    | Result                                                       |
| ------------------------ | ------------------------------------------------------------ |
| Push to `main`           | `cf deploy` — production updated                             |
| Push to any other branch | `cf previews deploy` — a preview, not promoted to production |
| Open a pull request      | Preview URLs posted as a PR comment                          |

Each PR comment carries two links: a stable branch alias (`<branch>-<worker>.<subdomain>.workers.dev`) that survives new commits, and a per-commit URL pinned to that exact version. You can also publish a preview by hand with `bun run deploy:preview`.

### Caveats

- **Preview versions share production bindings by default.** An instance preview reads and writes the same R2 bucket and D1 database as production, and applies its migrations to that database. Migrations only ever add, which is what keeps this safe. `cloudflare.config.ts` can check the `isPreview` flag cf passes to config factories to bind separate preview resources if that becomes a problem.
- **Workers with Durable Objects get no preview URLs.** The instance has none. The AppView has one (`JetstreamDO`), so it sets `previewUrls: false` and only deploys from `main`. In its Workers Builds settings, leave non-production branch builds off.

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

All instance configuration lives in `instance/cloudflare.config.ts`:

| Setting                 | Description                              |
| ----------------------- | ---------------------------------------- |
| `name`                  | Worker name                              |
| `env.DATA` name         | R2 bucket holding your data              |
| `env.IGLOO_TITLE`       | Site title                               |
| `env.IGLOO_TAGLINE`     | Site tagline                             |
| `env.IGLOO_THEME`       | Default visual theme (`repo` or `index`) |
| `env.IGLOO_APPVIEW_URL` | The AppView to notify after publishing   |
| `env.DB` name           | D1 database for instance state           |

The R2 and D1 bindings authenticate through your Cloudflare account. The only secrets are the optional `SETUP_CODE` and `OAUTH_SIGNING_KEY` (see [Deploy and claim](#4-deploy-and-claim)).

## API

The API is read-only. It exposes three data endpoints, an instance config endpoint, a health check, and the MCP endpoint:

| Endpoint                  | Description                                             |
| ------------------------- | ------------------------------------------------------- |
| `GET /health`             | Health check                                            |
| `GET /api/list?path=`     | List directory contents (files, subdirectories, README) |
| `GET /api/download?path=` | Download a file                                         |
| `GET /api/metadata?path=` | Get file metadata (size, type, modified date, etag)     |
| `GET /api/config`         | Instance configuration                                  |
| `POST /mcp`               | MCP endpoint (streamable HTTP, stateless)               |

See [`skills/igloo/references/api.md`](skills/igloo/references/api.md) for full request/response documentation.

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

- **MCP server** at `POST /mcp` — tools for `igloo_health`, `igloo_list`, `igloo_metadata`, `igloo_read_file`, and `igloo_config`. Point any MCP client at `https://your-igloo/mcp`.
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
