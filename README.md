# &#10052; igloo

**A personal data repository you deploy yourself.**

Igloo gives data scientists, ML engineers, and AI practitioners a simple, self-hosted way to store, browse, and share datasets over the web. Think of it as your own miniature data portal — a modernized take on the classic directory-listing servers that powered early dataset sharing in the ML community.

Deploy an igloo and you get:

- A **REST API** backed by S3-compatible object storage (Cloudflare R2)
- A **web UI** for browsing directories, viewing file metadata, downloading datasets, and reading inline documentation
- A **CLI** for terminal-native access to your data repo
- An **agent skill** so LLM-based tools can browse and retrieve your data programmatically

## Architecture

```
                ┌──────────────┐
                │ Cloudflare   │
                │ R2 Storage   │
                └──────┬───────┘
                       │
                ┌──────┴───────┐
                │   igloo API  │  Hono + Bun
                │   (REST)     │
                └──┬───────┬───┘
                   │       │
          ┌────────┘       └────────┐
          │                         │
   ┌──────┴───────┐         ┌──────┴───────┐
   │   Web UI     │         │     CLI      │
   │  SvelteKit   │         │     Go       │
   └──────────────┘         └──────────────┘
```

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) (runtime and package manager)
- [Go](https://go.dev) 1.23+ (for the CLI)
- A [Cloudflare R2](https://developers.cloudflare.com/r2/) bucket with API credentials

### 1. Clone and install

```bash
git clone https://github.com/cldixon/igloo.git
cd igloo
bun install
```

### 2. Configure R2 storage

Copy the example env file and fill in your R2 credentials:

```bash
cp .env.example api/.env
```

```env
R2_ACCESS_KEY_ID=<your-access-key>
R2_SECRET_ACCESS_KEY=<your-secret-key>
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_BUCKET_NAME=<your-bucket>
```

### 3. Run locally

```bash
bun run dev
```

This starts both the API (port 3001) and the web UI (port 5173) concurrently.

### 4. Build the CLI

```bash
cd cli
go build -o igloo .
```

Connect to your running instance:

```bash
./igloo connect http://localhost:3001
./igloo ls
```

## Project Structure

```
igloo/
├── api/                  # REST API (Hono + Bun)
│   └── src/
│       ├── index.ts      # Server entry point
│       ├── app.ts        # Hono app setup
│       ├── r2.ts         # R2 storage client
│       └── routes/       # API route handlers
├── web/                  # Web UI (SvelteKit + Svelte 5)
│   └── src/
│       ├── routes/       # SvelteKit pages
│       └── lib/          # Components, API client, utilities
├── cli/                  # CLI (Go + Cobra + Charm)
│   ├── cmd/              # Command implementations
│   ├── client/           # HTTP client for the igloo API
│   ├── config/           # Config file management
│   └── ui/               # Terminal styling and tree renderer
├── packages/shared/      # Shared TypeScript types
└── skills/igloo/         # Agent skill definition
```

## API

The API is read-only and exposes three data endpoints plus a health check:

| Endpoint | Description |
|---|---|
| `GET /health` | Health check |
| `GET /api/list?path=` | List directory contents (files, subdirectories, README) |
| `GET /api/download?path=` | Download a file |
| `GET /api/metadata?path=` | Get file metadata (size, type, modified date, etag) |

See [`skills/igloo/references/api.md`](skills/igloo/references/api.md) for full request/response documentation.

## CLI

The CLI is built with [Cobra](https://github.com/spf13/cobra) and styled with [Charm](https://charm.sh) libraries (Lip Gloss, Glamour) for a polished terminal experience.

```bash
igloo connect <url>       # Save an igloo instance URL
igloo ls [path]           # Browse directories (tree-style output)
igloo get <path> [-o dir] # Download a file
igloo info <path>         # Show file metadata
igloo health              # Check API connectivity
```

The CLI resolves the target instance with this precedence: `--url` flag > `IGLOO_API_URL` env var > `~/.igloo/config.yaml`.

## Web UI

The web interface provides a directory browser modeled after classic server index pages — updated with a modern, monospace-driven design. Features include breadcrumb navigation, file type icons, inline README rendering, and a light/dark mode toggle.

### Appearance

The UI ships with two visual themes and a light/dark mode toggle, all accessible from the settings menu (gear icon) in the top-right corner:

| Theme | Description |
|---|---|
| **Repo** | Card-based layout with rounded corners, JetBrains Mono + Inter fonts, and a modern repository feel |
| **Index** | Classic Apache `mod_autoindex` directory listing — monospace table, `[DIR]`/`[   ]` markers, "Index of /path" heading |

The default theme, site title, and tagline are configured in `igloo.config.yaml` at the repo root:

```yaml
title: igloo
tagline: personal data repository
theme: repo
```

The API serves this config at `GET /api/config`. Users can override the theme and color mode in-browser via the settings menu — preferences are saved to `localStorage`.

## Deployment

Igloo is designed to be deployed as two services (API + Web) on any platform that supports Bun. The reference deployment uses [Railway](https://railway.com):

- **API Service** — build: `bun install`, start: `cd api && bun src/index.ts`
- **Web Service** — build: `bun install && cd web && bun run build`, start: `cd web && bun ./build/index.js`

Set `VITE_API_URL` on the web service to point to your API service's URL.

### Environment Variables

**API service:**

| Variable | Description |
|---|---|
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret key |
| `R2_ENDPOINT` | R2 endpoint URL |
| `R2_BUCKET_NAME` | R2 bucket name |
| `PORT` | API port (default: 3001) |

**Web service:**

| Variable | Description |
|---|---|
| `VITE_API_URL` | URL of the igloo API service |

## Agent Skill

The `skills/igloo/` directory contains an [Agent Skills](https://agentskills.io) definition that teaches LLM agents how to interact with an igloo instance via the CLI. This enables AI coding assistants and autonomous agents to browse, inspect, and download datasets from your repository.

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | [Bun](https://bun.sh) |
| API | [Hono](https://hono.dev) |
| Storage | [Cloudflare R2](https://developers.cloudflare.com/r2/) (S3-compatible) |
| Web UI | [SvelteKit](https://svelte.dev) + Svelte 5 |
| CLI | [Go](https://go.dev) + [Cobra](https://github.com/spf13/cobra) + [Charm](https://charm.sh) |
| Deployment | [Railway](https://railway.com) |

## License

MIT
