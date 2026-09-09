# ❄ igloo

**A personal data repository you deploy yourself.**

Igloo gives data scientists, ML engineers, and researchers a simple way to store, browse, and share datasets over the web. Think of it as your own miniature data portal — a modernized take on the classic directory-listing servers that powered early dataset sharing in the ML community.

Deploy an igloo and you get:

- A **REST API** backed by Cloudflare R2 object storage
- A **web UI** for browsing directories, viewing file metadata, downloading datasets, and reading inline documentation
- A **CLI** for terminal-native access to your data repo
- An **MCP server** and **agent skill** so LLM-based tools can browse and retrieve your datasets

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cldixon/igloo)

The button clones this repo into your own GitHub account, provisions the R2 bucket, and wires up CI/CD — see [Continuous Deployment](#continuous-deployment). To set things up by hand instead, follow the Quick Start below.

## Architecture

Igloo runs entirely on Cloudflare. A single Worker serves both the REST API and
the web UI, reading from an R2 bucket through a native binding — there are no
storage credentials to manage.

```
                  ┌──────────────┐
                  │      R2      │
                  │   (bucket)   │
                  └──────┬───────┘
                         │ binding
                  ┌──────┴───────┐
                  │    Worker    │  Hono + Static Assets
                  │  API + UI    │
                  └──┬────────┬──┘
                     │        │
            ┌────────┘        └────────┐
            │                          │
     ┌──────┴───────┐          ┌───────┴──────┐
     │   Web UI     │          │  CLI / MCP   │
     │  SvelteKit   │          │  Go / agents │
     └──────────────┘          └──────────────┘
```

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
```

### 2. Authenticate and provision

```bash
bunx wrangler login
bun run setup
```

`bun run setup` prompts for your Worker name, bucket name, and site title, creates the R2 bucket if it does not already exist, and writes your answers into `wrangler.jsonc`.

### 3. Run locally

```bash
bun run dev
```

This starts `wrangler dev` on port 8787 (the Worker, bound to your real R2 bucket) and Vite on port 5173 (the UI, with HMR). Open http://localhost:5173.

Pass `--local` to use wrangler's simulated R2 instead of the live bucket:

```bash
bun run dev --local
```

### 4. Deploy

```bash
bun run deploy
```

This builds the web UI and deploys the Worker together as one unit.

`bun run setup` writes your custom domain into `wrangler.jsonc` as a route. The zone must be on your own Cloudflare account, or the deploy will fail:

```jsonc
"routes": [{ "pattern": "data.example.com", "custom_domain": true }]
```

Answer the domain prompt with a blank line to drop the route and serve from `*.workers.dev` instead. `setup` keeps the two in step: giving a domain sets `workers_dev` to `false` so the custom domain is the only way in, and leaving it blank sets it to `true` so the Worker still has a route.

## Continuous Deployment

Igloo deploys as a **single Worker** — the API and the web UI ship together as one artifact — so [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) handles the whole pipeline natively.

The two systems have separate jobs, and neither does the other's work:

| System                                          | Responsibility                                                                                                                                                    |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GitHub Actions** (`.github/workflows/ci.yml`) | Every quality check. Worker: type check, `svelte-check`, tests, build, and `wrangler deploy --dry-run` to validate the config. CLI: `gofmt`, `go vet`, `go test`. |
| **Workers Builds**                              | Building and deploying only                                                                                                                                       |

Connect the repo once:

1. In the Cloudflare dashboard, open your Worker → **Settings** → **Build**.
2. Connect your GitHub repository.
3. Set the build command to `bun install && bun run build`.
4. Leave the deploy command as `npx wrangler deploy`.
5. Under **Branch control**, enable **non-production branch builds** (off by default — this is what produces the PR previews).

You then get:

| Event                    | Result                                                                 |
| ------------------------ | ---------------------------------------------------------------------- |
| Push to `main`           | `wrangler deploy` — production updated                                 |
| Push to any other branch | `wrangler versions upload` — a new version, not promoted to production |
| Open a pull request      | Preview URLs posted as a PR comment                                    |

Each PR comment carries two links: a stable branch alias (`<branch>-<worker>.<subdomain>.workers.dev`) that survives new commits, and a per-commit URL pinned to that exact version. You can also publish a preview by hand with `bun run deploy:preview`.

### Caveats

- **Preview versions share production bindings.** Workers cannot vary bindings between production and preview builds, so every preview reads the same R2 bucket as production. That is harmless while igloo is read-only; it needs a separate preview bucket via [Wrangler Environments](https://developers.cloudflare.com/workers/wrangler/environments/) once a write path exists.
- **Preview URLs require no Durable Objects.** Workers that implement a Durable Object do not get preview URLs generated. Igloo does not use them today.

## Adding Data

Igloo is currently read-only over HTTP — upload with any S3-compatible tool:

```bash
# a single file
bunx wrangler r2 object put my-bucket/datasets/iris.csv --file=iris.csv

# a whole directory (recommended for large datasets)
rclone copy ./my-dataset r2:my-bucket/my-dataset
```

A `README.md` at any prefix is rendered inline when browsing that directory.

## Configuration

All instance configuration lives in `wrangler.jsonc`:

| Setting                     | Description                              |
| --------------------------- | ---------------------------------------- |
| `name`                      | Worker name                              |
| `r2_buckets[0].bucket_name` | R2 bucket holding your data              |
| `vars.IGLOO_TITLE`          | Site title                               |
| `vars.IGLOO_TAGLINE`        | Site tagline                             |
| `vars.IGLOO_THEME`          | Default visual theme (`repo` or `index`) |

There are no secrets or `.env` files — the R2 binding authenticates through your Cloudflare account.

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
| Tooling   | [Bun](https://bun.sh) + [Wrangler](https://developers.cloudflare.com/workers/wrangler/)    |

## License

MIT
