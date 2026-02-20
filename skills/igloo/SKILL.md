---
name: igloo
description: Interact with an igloo personal data repository via the igloo CLI. Use when the user wants to browse datasets, download files, check file metadata, or manage their connection to an igloo instance.
compatibility: Requires the igloo CLI binary (Go) on PATH. Requires network access to the target igloo API instance.
allowed-tools: Bash(igloo:*)
---

# Igloo CLI

Igloo is a personal data repository. Each user deploys their own instance with their own URL — there is no central server. The `igloo` CLI provides terminal access to any igloo instance.

## Setup

Before using any data commands, an agent must be connected to an igloo instance. Check if a connection exists:

```bash
cat ~/.igloo/config.yaml
```

If no config exists or the user provides a URL, connect:

```bash
igloo connect <url>
```

This saves the API URL to `~/.igloo/config.yaml`. The CLI resolves the target URL with this precedence: `--url` flag > `IGLOO_API_URL` env var > config file.

## Commands

### List directory contents

```bash
# List root
igloo ls

# List a subdirectory
igloo ls datasets/census
```

Output is a tree-style listing showing directories and files with sizes and dates. If the directory contains a `README.md`, its rendered content is displayed below the tree.

### Download a file

```bash
# Download to current directory
igloo get datasets/iris.csv

# Download to a specific directory
igloo get datasets/iris.csv --output ~/downloads
```

### Show file metadata

```bash
igloo info datasets/iris.csv
```

Returns name, path, size, last modified date, content type, and etag.

### Check connectivity

```bash
igloo health
```

Returns status, URL, and latency.

### Override URL for a single command

Any command accepts `--url` to target a different instance:

```bash
igloo ls --url https://other-instance.example.com
```

## Browsing workflow

To explore an igloo instance, start at the root and navigate into directories:

1. `igloo ls` — see top-level directories
2. `igloo ls <directory>` — drill into a directory
3. `igloo info <file>` — inspect a specific file
4. `igloo get <file>` — download when needed

## Path conventions

- Paths use forward slashes (`/`)
- Trailing slashes on directories are optional
- The root is an empty path (just `igloo ls` with no argument)
- Paths are relative to the repository root — no leading slash needed

## API reference

The CLI wraps a REST API. See [references/api.md](references/api.md) for endpoint details and data model documentation.
