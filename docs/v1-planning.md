---
title: Igloo V1 Planning Document
description: Comprehensive planning doc for the igloo pivot — from self-hosted data repo on Railway to multi-tenant agent working memory platform on Cloudflare.
created: 2026-04-12
superseded: 2026-09-08
status: superseded
---

# Igloo V1 Planning Document

> [!IMPORTANT]
> **Superseded on 2026-09-08. Kept for the record; do not treat as current direction.**
>
> This document plans a pivot that was not taken. It describes igloo as a
> managed, multi-tenant "agent working memory" service, with D1 as the primary
> store for plaintext documents and R2 deferred to a later version.
>
> The direction taken instead returns to the original vision: a **self-hostable
> dataset repository** in the spirit of the early ML autoindex sites, deployed
> by each user to their own Cloudflare account. Specifically, the following
> parts of this document are wrong:
>
> | This document says | Actual direction |
> |---|---|
> | Managed multi-tenant SaaS with signup and billing | Self-hosted, single-tenant per deployment |
> | Positioned as agent working memory for markdown docs | Positioned around datasets, sharing and research |
> | D1 as primary storage, R2 deferred to v2+ | R2 is the source of truth; D1 is a derived index |
> | Durable Objects per tenant for tokens and permissions | No Durable Objects (they also disable PR preview URLs) |
> | Iceberg/SQL deferred to v3 | Live, and much cheaper via R2 Data Catalog + R2 SQL |
> | Storing agent skills and `AGENTS.md` files as content | Dropped. The CLI/MCP agent *interface* is kept |
>
> What did carry over: consolidating onto Cloudflare, Hono on Workers, and
> keeping the CLI and MCP server as first-class agent interfaces.
>
> Current state lives in the README; planned work lives in the GitHub issues.
> The reasoning behind the Cloudflare move is in
> [`cloudflare-infra-chat.md`](cloudflare-infra-chat.md), which remains
> accurate on the platform question even where its product framing does not.

## 1. What Igloo Is

Igloo is a personal data repository deployed as a managed service. Users sign up, get a tenant (e.g., `alice.igloo.dev`), and store documents, datasets, and reference files that are accessible from anywhere — by the user, by their AI agents, or by anyone they choose to share with.

The initial wedge is **agent working memory**: the documents, notes, specs, conventions, and references that inform how AI coding agents behave across sessions and projects. Today these live as scattered markdown files in code repos (`CLAUDE.md`, `AGENTS.md`, `DESIGN.md`), in chat transcripts that get lost, or in the user's head. Igloo gives them a permanent, searchable, permissioned home that any agent can reach.

### Why This Framing

- The "personal data repo" framing makes people think Hugging Face. The "agent working memory" framing makes people think "I need this tomorrow."
- Every developer using AI coding tools has this problem today. The audience is large and immediate.
- The permission model is load-bearing: agents need scoped access to specific content, and users need to trust that access is controlled.
- Datasets, SQL queries, and semantic search are real features that build on this foundation — but they serve users who already have data to manage. The working memory use case serves anyone who uses AI tools.

### What Igloo Is Not (In V1)

- Not a Hugging Face competitor (no community discovery, no social layer)
- Not a general-purpose object storage service (not competing with S3/R2 directly)
- Not a self-hosted tool (open source for trust, but hosted as a managed service)
- Not an AI feature itself (igloo stores and serves content — the intelligence is in the agents that use it)


## 2. Who It's For

### Primary User: The Multi-Agent Developer

A software engineer or data scientist who uses multiple AI coding tools (Claude Code, Claude web, Cursor, etc.) across multiple projects. They are tired of:

- Copy-pasting the same context between agent sessions
- Losing architectural decisions recorded in chat transcripts
- Maintaining duplicate `AGENTS.md` and convention docs across repos
- Having no persistent memory layer that spans projects and tools

### The Agent as User

Agents are first-class users of igloo, not just consumers of an API. An agent connected to igloo can:

- **Read** documents, datasets, and reference files
- **Search** across the igloo using grep and find primitives
- **Discover** what's available via a manifest/orientation endpoint
- **Write** new documents (with appropriate token permissions) — capturing findings, decisions, and artifacts that persist beyond the current session

### Access Patterns

| User | Access Method | Primary Actions |
|---|---|---|
| Human (owner) | Web UI | Browse, upload, manage permissions, view usage |
| Human (visitor) | Public URL | Read shared documents |
| AI agent (owner's) | MCP / CLI | Read, search, discover, write |
| AI agent (external) | MCP with scoped token | Read permitted content |
| Script / CI | REST API | Automated read/write |


## 3. User Experience

### 3.1 Agent Experience

#### Two Integration Channels

Igloo supports two complementary integration paths for agents. Both hit the same REST API and produce the same results.

**MCP (Model Context Protocol)** — the "zero-install" path. The user adds igloo as an MCP server in their agent platform settings. The agent gets structured tool calls (`igloo_discover`, `igloo_grep`, etc.) automatically. Best for platforms with native MCP support (Claude Desktop, Cursor, etc.).

**CLI + SKILL.md** — the "power user" path. The user installs the `igloo` CLI binary, which drops a skill doc into the agent platform's skill directory. The agent reads the skill doc and shells out to `igloo` bash commands. More transparent, composable with other CLI tools, and works with any agent that has bash access. Many platforms have converged on the skill doc pattern with dedicated directories (`~/.claude/skills/`, `~/.kiro/skills/`, etc.).

Both channels are offered simultaneously. The CLI can bootstrap both — see "Onboarding" below.

#### Discovery: How an Agent Knows Igloo Exists

The agent learns about igloo through one of two mechanisms:

1. **MCP connection** — configured in the agent platform's MCP settings. The agent discovers igloo tools automatically at session start, the same way it discovers any MCP server.
2. **Skill doc** — installed to the agent platform's skill directory. The agent reads the `SKILL.md` and learns the CLI commands. The skill doc includes the instance URL and usage instructions.

Both are set up once and work across all projects and sessions — no per-repo configuration needed.

#### Onboarding: `igloo setup`

The CLI bootstraps agent integration with a single command:

```bash
# Install and connect
brew install igloo
igloo connect https://alice.igloo.dev --token iglk_abc123

# Auto-detect installed agent platforms and configure them
igloo setup
```

`igloo setup` performs the following:

1. **Detects installed agent platforms** by checking for known directories:
   - `~/.claude/` → Claude Code
   - `~/.kiro/` → Kiro
   - `~/.cursor/` → Cursor
   - `~/.continue/` → Continue
   - Others as they emerge

2. **Installs the SKILL.md** to each detected platform's skill directory:
   - `~/.claude/skills/igloo/SKILL.md`
   - `~/.kiro/skills/igloo/SKILL.md`

3. **Configures MCP** for platforms that support it:
   - Writes the MCP server entry to `~/.claude/mcp_servers.json` or equivalent

4. **Reports what it did:**
   ```
   Detected agent platforms:
     ✓ Claude Code — skill installed at ~/.claude/skills/igloo/SKILL.md
     ✓ Claude Code — MCP server configured in ~/.claude/mcp_servers.json
     ✗ Kiro — not detected

   Your agents can now access your igloo. Try asking:
     "Search my igloo for Python conventions"
   ```

Selective setup is also supported:

```bash
igloo setup claude       # just Claude Code
igloo setup --mcp        # only configure MCP, skip skill doc
igloo setup --skill      # only install skill doc, skip MCP
```

The installed SKILL.md is **generated dynamically** from the user's configuration — not a static file baked into the binary. It includes the instance URL and reflects the installed CLI version's full command set:

```markdown
---
name: igloo
description: Access your igloo personal data repository. Search for documents,
  read files, and write notes across all your projects.
compatibility: Requires the igloo CLI on PATH.
allowed-tools: Bash(igloo:*)
---

# Igloo

Your igloo instance is at `https://alice.igloo.dev`.
Authentication is configured in `~/.igloo/config.yaml`.

## Quick Start

Start by discovering what's in your igloo:
igloo discover

## Commands

### Search for content
igloo grep "search term" [path] [--glob "*.md"]
igloo find "*.md" [path]

### Read and write
igloo read docs/conventions.md
igloo write docs/notes.md --content "..."
igloo write docs/notes.md --file ./local-file.md

### Browse
igloo ls [path]
igloo info <path>

### Manage files
igloo mv old/path.md new/path.md
igloo cp source.md destination.md
```

#### Full Onboarding Flow

From zero to "my agent can search my knowledge base" in three commands:

```
brew install igloo
igloo signup                     # opens browser → create account → returns token
igloo setup                      # detects agents → installs skill + MCP
```

Then in the next agent session:
```
User: "Check my igloo for any project docs related to this repo"
Agent: igloo discover → igloo grep → igloo read
```

#### Orientation: The `discover` Endpoint

An agent's first call in any session — whether via MCP (`igloo_discover`) or CLI (`igloo discover`) — returns:

- Owner and instance info
- Project listings with doc counts and last-updated dates
- Topic tags aggregated from document frontmatter
- Recent activity
- Basic stats (total docs, active tokens)

This gives the agent enough context to decide what to search for, without reading every document.

#### Search: grep and find Over the Igloo

Two search primitives that mirror how coding agents explore codebases:

- **`igloo_find(pattern, path?)`** / `igloo find "pattern" [path]` — find files/directories by name or glob pattern. Backed by D1 `path GLOB` query.
- **`igloo_grep(pattern, path?, glob?, context?)`** / `igloo grep "pattern" [path]` — search file contents by text or regex. Backed by D1 FTS5 query. Returns matched lines with file paths, line numbers, and surrounding context.

These are sufficient for an agent to locate relevant content through iterative search — the same pattern that makes Claude Code effective at navigating codebases.

#### Reading and Writing

- **`igloo_read_file(path)`** / `igloo read <path>` — returns the raw markdown content of the document.
- **`igloo_write_file(path, content)`** / `igloo write <path>` — creates or updates a document. Requires a token with write permission for the target prefix. All writes are versioned.

#### The Full Agent Interaction Loop

Via MCP:
```
1. igloo_discover()              → orient: what projects/topics exist?
2. igloo_find("*", "projects/")  → browse: what's in the projects prefix?
3. igloo_grep("cloudflare")      → search: which docs mention cloudflare?
4. igloo_read_file("projects/igloo/v1-planning.md")  → read the relevant doc
5. [do work informed by the document]
6. igloo_write_file("projects/igloo/session-notes/2026-04-12.md", content)
   → persist findings for next session
```

Via CLI (identical operations, bash commands):
```
1. igloo discover                             → orient
2. igloo find "*" projects/                   → browse
3. igloo grep "cloudflare"                    → search
4. igloo read projects/igloo/v1-planning.md   → read
5. [do work]
6. igloo write projects/igloo/session-notes/2026-04-12.md --file ./notes.md
   → persist
```

### 3.2 Document Discoverability

Documents in igloo are discoverable through multiple reinforcing mechanisms:

#### Prefix Conventions
Organize by project or topic: `projects/igloo/`, `docs/conventions/`, `prompts/`. Agents navigate these naturally via `igloo_find`.

#### Frontmatter Metadata
Igloo documents use a lightweight metadata schema in markdown frontmatter:

```yaml
---
title: Python Coding Conventions
description: Preferred patterns, tools, and style for Python projects
project: igloo          # optional — associates with a project
tags: [python, conventions, style]
created: 2026-04-12
---
```

Fields are optional and open-ended. The `project` and `tags` fields are greppable, enabling cross-project discovery: `igloo_grep("project: igloo")` finds every doc associated with igloo regardless of prefix location.

#### Reverse Pointers
Documents can reference the repositories or contexts they're relevant to:

```yaml
---
repos: [cldixon/igloo, cldixon/ml-pipeline]
---
```

An agent working in `cldixon/igloo` can grep for that identifier and find all associated docs. The codebase stays clean; the metadata lives with the document.

#### Auto-Generated Index (via `discover` endpoint)
The `discover` endpoint aggregates prefix structure, frontmatter metadata, and recent activity into a structured orientation response. No static index file to maintain — it's computed from the live state of the igloo.

#### Content Search (grep fallback)
A doc about igloo planning will contain "igloo" many times. Grep always works as a fallback, no conventions required.

### 3.3 Human Experience — Web UI

The web UI serves three modes:

#### Browser Mode (Private, Logged In)
The existing directory listing interface, adapted for the new platform. Navigate prefixes, see files with metadata, upload and manage content. The current "Repo" theme works well here. The logged-in landing page is essentially a rendered version of the `discover` endpoint — projects, recent docs, usage stats.

#### Document Mode (Reading a File)
When a user navigates to a specific markdown file — or a visitor opens a public link — igloo renders it as a clean, readable page. Good typography, syntax highlighting, table of contents for long docs, metadata header (title, last modified, tags). The URL is both the R2 path and the shareable address: `alice.igloo.dev/docs/python-conventions.md`.

#### Dashboard Mode (Managing Access)
Token management, per-prefix visibility (private/public/shared), usage metrics, audit log. Shows which tokens are active, what they can access, when they last accessed, and request volume. This is where the human exercises control over agent and external access.

### 3.4 Human + Agent Duality

Same content, same URLs, different representations:

```
alice.igloo.dev/docs/api-spec.md
```

| Access method | What happens |
|---|---|
| Human in browser | Rendered markdown, typography, breadcrumbs, share button |
| Agent via MCP | `igloo_read_file` → raw text with metadata header |
| Agent via CLI (skill) | `igloo read docs/api-spec.md` → raw content to stdout |
| CLI download | `igloo get docs/api-spec.md` → file saved to disk |
| Script via REST | `GET /api/read?path=docs/api-spec.md` → raw content |

The permission check is identical regardless of method. The content is identical. Only the presentation adapts.


## 4. Technical Architecture

### 4.1 Platform: Cloudflare

The entire v1 runs on Cloudflare's platform, consolidating from the current Railway + R2 split:

| Component | Cloudflare Service | Role |
|---|---|---|
| API + routing | **Workers** | Request handling, auth, business logic |
| Document storage | **D1** | Text content, metadata, FTS5, version history (see Section 5) |
| Per-tenant state | **Durable Objects** | Permissions, tokens, audit log, rate limits. Embedded SQLite per tenant. |
| User accounts | **D1** | Signup, billing, global metadata, public discovery index |
| Asset storage (v2+) | **R2** | Binary files, datasets, large files — deferred until needed |
| Frontend | **Pages** (or Workers) | SvelteKit app, static assets. |

> **Note:** The original design used R2 as the sole storage layer. Section 5 proposes D1 as the primary storage for plaintext documents in v1, with R2 deferred to v2+ for binary assets and datasets. This simplifies the architecture and makes search/discovery significantly faster.

#### Why Cloudflare Over Railway

- **D1 gives us indexed search for free.** FTS5 turns grep and discover into SQL queries instead of fetching and scanning files in memory.
- **Durable Objects are purpose-built for per-tenant state.** One DO per tenant with embedded SQLite for permissions, tokens, and audit — strongly consistent, no external database needed for this layer.
- **Scale-to-zero pricing.** Workers charge per request; Railway charges for containers running 24/7. For a new product with low/bursty traffic, this is significantly cheaper.
- **Single vendor, single bill.** Storage, compute, database, CDN, DNS — one platform.

#### What We Give Up

- Local development requires `wrangler dev` + Miniflare (more friction than `bun run dev`)
- Workers runtime is V8 isolates, not Node.js (Hono is portable, but DO/D1 bindings are CF-specific)
- 30s CPU limit on Workers means future compute-heavy features (SQL queries, embeddings) need Containers

#### Mitigations

- Keep business logic decoupled from platform bindings behind clean interfaces
- Test early with `wrangler dev` to surface DX issues
- Plan for Containers in v2/v3, not v1

### 4.2 Multi-Tenant Design

#### Tenant Isolation

All documents are scoped by `tenant_id` in D1. Every query includes `WHERE tenant_id = ?`, enforced at the data access layer. The Worker resolves the tenant from the auth token before any data operation. A bug in the authorization layer is the primary risk — the permission code must be thorough and well-tested.

#### Request Flow

```
Request → Worker
  → Extract token from Authorization header
  → Look up tenant from token (D1 or cached)
  → Get stub for tenant's Durable Object
  → DO checks: is this token allowed to [read|write|admin] this path?
  → If allowed: Worker queries D1 with tenant_id scope
  → Return response
```

#### Durable Object (Per Tenant)

Each tenant's DO holds:
- **Token table** — token hash, scopes (read/write/admin), allowed prefixes, expiry, label
- **Visibility rules** — per-prefix public/private settings
- **Audit log** — recent access events (token, action, path, timestamp)
- **Rate limit state** — request counters per token

All stored in the DO's embedded SQLite. Strongly consistent, single-writer, no cross-tenant contention.

#### D1 (Global)

- **Users table** — email, tenant_id, plan, created_at, stripe_customer_id
- **Public index** — paths marked public, for cross-tenant discovery (later)
- **Billing state** — plan, usage counters, overage tracking

### 4.3 Permissions Model

#### Defaults

- All content is **private by default**
- Tokens must be explicitly created with specific scopes
- No anonymous access unless a path is explicitly marked public

#### Token Scopes

| Scope | Allows |
|---|---|
| `read` | Read files, list directories, search, discover |
| `write` | Create and update files (all writes are versioned) |
| `admin` | Manage tokens, change visibility, delete files |

Scopes are combined with **prefix restrictions**: a token can have `read` on `projects/igloo/` and `write` on `projects/igloo/session-notes/`. This enables patterns like:

- A Claude Code token with broad read + narrow write
- A CI token with read-only access to `configs/`
- A collaborator token with read access to one specific directory

#### Public Paths

Any prefix or individual file can be marked public. Public content is accessible without a token, viewable in a browser, and indexed by the `discover` endpoint. Making something public is an explicit action in the dashboard, not a default.

#### Agent Write Guardrails (V1)

- Tokens have explicit write scope — most tokens should be read-only
- All writes are versioned (row-level in D1) — nothing is truly lost
- Audit log records every write with the token that made it
- No delete permission for agent tokens in v1 — only humans delete through the web UI


## 5. Storage Architecture: D1 vs R2

The original igloo prototype used R2 (S3-compatible object storage) as the sole storage layer, which made sense when the product was a general-purpose data repository for arbitrary files. As the product focus has sharpened toward plaintext documents and agent working memory, it's worth reconsidering whether object storage is the right primary storage for v1.

### 5.1 The Case for D1 as Primary Document Storage

The v1 use case is predominantly **plaintext documents with optional frontmatter metadata**, accessed through content search (grep), name search (find), and structured queries (discover). This usage pattern is closer to a document database than a blob store.

With R2, operations like grep require fetching every text file from storage and searching in memory — an O(n) operation on every query that raises performance concerns as an igloo grows. With D1 (Cloudflare's serverless SQLite), these operations become indexed queries.

#### Proposed D1 Schema

```sql
CREATE TABLE documents (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  path        TEXT NOT NULL,        -- e.g., "projects/igloo/v1-planning.md"

  -- decomposed frontmatter (queryable)
  title       TEXT,
  description TEXT,
  project     TEXT,
  tags        TEXT,                 -- JSON array: ["architecture", "cloudflare"]

  -- content
  content     TEXT NOT NULL,        -- markdown body (without frontmatter)
  raw         TEXT NOT NULL,        -- original file as submitted (frontmatter + body)

  -- system metadata
  content_type TEXT DEFAULT 'text/markdown',
  size        INTEGER,
  version     INTEGER DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now')),
  created_by  TEXT,                 -- token id

  UNIQUE(tenant_id, path, version)
);

-- full-text search across content and metadata
CREATE VIRTUAL TABLE documents_fts USING fts5(
  path, title, description, tags, content,
  content=documents,
  content_rowid=rowid
);
```

Key design decisions:
- **`content`** (body only) is what FTS5 indexes and grep searches. Frontmatter YAML syntax doesn't pollute search results.
- **`raw`** (original file) is what `igloo_read_file` returns. Guarantees exact round-trip fidelity — what you write is exactly what you read back.
- **Structured columns** (`title`, `project`, `tags`) enable fast queries for `discover` and `find` without parsing at read time.

#### Write Path: Markdown In

When a document is written (via MCP, CLI, or upload), the Worker:

1. Parses frontmatter — splits the markdown into `{ data, content }` (e.g., using `gray-matter`)
2. Stores structured fields — frontmatter values go into their respective columns
3. Stores the raw original — the complete submitted file goes into `raw`
4. FTS5 updates automatically via SQLite triggers

The system doesn't require frontmatter. A plain markdown file with no `---` block stores with null metadata columns and still gets full-text indexed.

#### Read Path: Markdown Out

When a document is read, the Worker returns the `raw` column — the exact original file. Agents and users never see D1; they write markdown and read markdown.

#### How Filesystem Operations Map to D1

| Operation | SQL | Notes |
|---|---|---|
| `ls` (list) | `SELECT path, title, size, updated_at FROM documents WHERE tenant_id = ? AND path GLOB 'prefix/*'` | Worker partitions results into files vs. subdirectories by checking for `/` in the remaining path segment |
| `read` | `SELECT raw FROM documents WHERE tenant_id = ? AND path = ? ORDER BY version DESC LIMIT 1` | Returns exact original markdown |
| `write` | `INSERT INTO documents (...)` | Frontmatter parsed and indexed automatically on write |
| `mv` (move) | `UPDATE documents SET path = REPLACE(path, ?, ?) WHERE tenant_id = ? AND path GLOB 'old/*'` | Atomic, instant — no data copied. Vastly simpler than R2 (which requires copy + delete per object) |
| `cp` (copy) | `INSERT INTO documents (...) SELECT ... FROM documents WHERE ...` | New row, same content, version resets to 1 |
| `rm` (delete) | `DELETE FROM documents WHERE tenant_id = ? AND path = ?` | Or soft-delete with `deleted_at` for trash/recovery |
| `grep` | `SELECT path, snippet(...) FROM documents_fts WHERE documents_fts MATCH ?` | FTS5 indexed — orders of magnitude faster than fetching files from R2 |
| `find` | `SELECT path FROM documents WHERE tenant_id = ? AND path GLOB ?` | Indexed on path column |
| `discover` | `SELECT project, COUNT(*), MAX(updated_at) FROM documents WHERE tenant_id = ? GROUP BY project` | One query — no need to list objects and parse each file's frontmatter |
| `mkdir` | Not needed | Directories are implied by document paths. They appear when documents exist in them. |

#### Comparison: D1 vs R2 for v1

| Concern | R2 (Object Storage) | D1 (SQLite) |
|---|---|---|
| Grep/content search | Fetch all files, search in memory. O(n), performance risk at scale. | FTS5 query. Indexed, fast, scales well. |
| Find/name search | ListObjectsV2 with prefix. Native, fast. | `SELECT ... WHERE path GLOB`. Equivalent. |
| Discover/aggregation | List objects + parse frontmatter from each. Slow, requires caching. | Single SQL query on structured columns. |
| Read file | GetObject. Works. | SELECT by path. Equivalent for text. |
| Write file | PutObject. Works. | INSERT with frontmatter parsing. Richer. |
| Move/rename | Copy + delete per object. Expensive for prefixes. | UPDATE path. Atomic, instant. |
| Versioning | R2 bucket versioning (per-object). | Row-level, version column. More control. |
| Binary/large files | Purpose-built for this. | Wrong tool. 10GB DB limit. |
| Storage cost | $0.015/GB-month | Included in Workers paid plan (up to limits) |

### 5.2 Recommended Approach: D1 Primary, R2 for Assets

For v0.5/v1, use **D1 as the primary storage layer** for plaintext documents. R2 is deferred to v2+ when binary assets, datasets, and large files enter the picture.

The API interface remains identical regardless of storage backend. Agents don't know or care whether `igloo_read_file` queries D1 or fetches from R2 — that's an internal implementation detail.

When R2 is added later, the routing logic is simple: check content type or file size on write, store text documents in D1 and binary/large assets in R2. On read, check D1 first (fast), fall back to R2 for assets. A future `assets` table would store R2 key references:

```sql
-- future: for binary files, large files, datasets
CREATE TABLE assets (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  path        TEXT NOT NULL,
  r2_key      TEXT NOT NULL,       -- pointer to R2 object
  content_type TEXT,
  size        INTEGER,
  created_at  TEXT,
  updated_at  TEXT,
  UNIQUE(tenant_id, path)
);
```

### 5.3 D1 Limits to Monitor

- **10GB database size limit** per D1 database. For plaintext documents this is substantial (millions of docs), but it's a ceiling that doesn't exist with R2.
- **Eventual consistency on reads** across regions. Writes go to a primary; read replicas may lag slightly. Fine for a document store, not suitable for real-time collaboration.
- **Row size limits.** Very large individual documents (multi-MB markdown files) could be problematic. In practice, most agent docs are well under 1MB.

### 5.4 Impact on Architecture Table

With D1 as primary storage, the Cloudflare service map simplifies for v1:

| Component | Cloudflare Service | Role |
|---|---|---|
| API + routing | **Workers** | Request handling, auth, business logic |
| Document storage | **D1** | Text content, metadata, FTS5, version history |
| Per-tenant state | **Durable Objects** | Tokens, permissions, audit log, rate limits |
| User accounts | **D1** (same or separate DB) | Signup, billing, global state |
| Frontend | **Pages** (or Workers) | SvelteKit app |
| Asset storage (v2+) | **R2** | Binary files, datasets, large files |

No R2 configuration needed in v0.5. The entire product is Worker + D1 + DO + Pages.


## 6. V0.5 / V1 Feature Scope

### Core Platform
- [ ] Cloudflare Worker with Hono, replacing Railway API
- [ ] D1 schema for documents (content, metadata, FTS5) and user accounts
- [ ] Durable Object class for per-tenant state (tokens, permissions, audit)
- [ ] User signup and authentication
- [ ] Token creation and management (scopes, prefix restrictions, expiry)
- [ ] Per-prefix visibility controls (private/public)

### Document Operations
- [ ] List directory contents (`GET /api/list`) — D1 query with path partitioning
- [ ] Read file (`GET /api/read`) — returns raw markdown from D1
- [ ] Get file metadata (`GET /api/metadata`) — structured columns from D1
- [ ] Write file (`POST /api/write`) — parses frontmatter, stores in D1
- [ ] Move/rename (`POST /api/move`) — atomic path update in D1
- [ ] Copy (`POST /api/copy`) — insert from select in D1
- [ ] Delete file — admin/owner only (`DELETE /api/delete`)
- [ ] Version history — row-level versioning in D1

### Search
- [ ] Find files by name/glob (`GET /api/find`) — D1 path GLOB query
- [ ] Grep file contents by text/regex (`GET /api/grep`) — D1 FTS5 query

### Discovery
- [ ] `GET /api/discover` — igloo manifest/orientation endpoint
- [ ] Aggregates prefix structure, frontmatter metadata, recent activity
- [ ] `GET /api/config` — instance configuration (title, tagline, theme)

### MCP Server
- [ ] `igloo_discover` — orient an agent to the igloo
- [ ] `igloo_list` — list directory contents
- [ ] `igloo_find` — find files by name pattern
- [ ] `igloo_grep` — search file contents
- [ ] `igloo_read_file` — read file content
- [ ] `igloo_write_file` — create/update files (requires write token)
- [ ] `igloo_metadata` — get file metadata
- [ ] `igloo_health` — server status

### CLI
- [ ] `igloo signup` — opens browser to create account, returns token
- [ ] `igloo connect` — save instance URL + token
- [ ] `igloo setup` — auto-detect agent platforms, install SKILL.md + configure MCP
- [ ] `igloo discover` — instance orientation
- [ ] `igloo ls` — list directories
- [ ] `igloo find` — find by name pattern
- [ ] `igloo grep` — search file contents
- [ ] `igloo read` — read file content to stdout
- [ ] `igloo write` — create/update file (from `--content` string or `--file` path)
- [ ] `igloo mv` — move/rename file or prefix
- [ ] `igloo cp` — copy file
- [ ] `igloo get` — download file to local disk
- [ ] `igloo info` — file metadata
- [ ] `igloo health` — connectivity check

### Agent Integration
- [ ] Dynamic SKILL.md generation (templated with instance URL, reflects current CLI commands)
- [ ] Platform detection for `igloo setup` (Claude Code, Kiro, Cursor, Continue)
- [ ] MCP server config writing for `igloo setup --mcp`
- [ ] Skill doc installation for `igloo setup --skill`
- [ ] API reference doc for skill/MCP tool descriptions

### Web UI
- [ ] Login / signup flow
- [ ] Directory browser (existing, adapted for multi-tenant)
- [ ] Document viewer — rendered markdown for individual files
- [ ] Upload interface (drag-and-drop or form)
- [ ] Dashboard — token management, visibility controls, usage metrics, audit log
- [ ] Public document view (no auth required for public paths)
- [ ] Settings — theme, profile


## 7. What's Deferred

These features are planned but intentionally deferred:

### V2 — "Search Your Igloo" (Semantic + Lexical Retrieval)
- LanceDB in R2 for hybrid search (BM25 + vector), run in a Cloudflare Container
- Embedding pipeline via Workers AI
- `igloo_search` MCP tool with semantic understanding
- Richer search results in the web UI
- Project-scoped dense search for large document collections (AutoRAG or custom)

### V3 — "Query Your Data" (SQL Over Structured Data)
- DuckDB-WASM in the frontend for client-side table viewing and SQL queries
- DuckDB in a Container for server-side SQL via API/MCP
- `igloo_query` MCP tool
- Table viewer component in the web UI (MotherDuck/HF Datasets style)
- R2 Data Catalog / Iceberg integration (when it stabilizes)

### Later
- AT Protocol integration for federated discovery
- Team accounts / multi-seat tenants
- Custom domains (`data.example.com` → your igloo)
- One-click data export (R2 tarball + DO SQLite dump)
- Webhooks on content changes


## 8. Business Model

### Pricing

**Target: $5/month flat base**, including:
- 10 GB storage
- 100k–200k requests/month (generous enough for power users with multiple agents)
- Unlimited tokens and prefix rules
- All features (no feature gating in v1)

**Overages** above included tier:
- Storage: ~$0.05/GB-month (markup over R2's $0.015)
- Requests: TBD based on real usage data

**Zero egress fees** — passed through from R2. This is the key marketing differentiator.

### Launch Strategy

- **Free trial** (14-30 days), not a free tier. Full functionality, then read-only lapse.
- **Founding pricing**: $5/month locked forever for the first 100 users. Creates urgency, rewards early adopters, generates signal.
- **Annual option**: $48/year ($4/month effective) for users who want to commit.

### Cost Structure

At 100 users × 10 GB average = 1 TB R2 storage:
- R2: ~$15/month
- Workers paid plan: $5/month base + usage
- D1/DO: minimal at this scale
- **Total CF bill: ~$25-40/month**
- **Revenue: ~$500/month**

Margins are healthy. The question is growth rate, not unit economics.

### What Helps Conversion

Trust signals matter disproportionately for a data storage product:
- Open-source code (users know they could self-host if the service disappeared)
- Public changelog
- Status page
- Clear backup/export policy
- Real human identity on the homepage
- Usage dashboard showing value ("your agents hit igloo 12,000 times this week")


## 9. Migration Path from Current Codebase

### What Carries Over
- **Hono framework** — Hono runs on Workers natively. Route structure and middleware patterns port directly.
- **Shared types** — `DirectoryEntry`, `DirectoryListing`, `FileMetadata`, `IglooConfig` remain the same (may need minor extensions).
- **SvelteKit frontend** — the component library, themes, and routing structure carry over. Deployment target changes from Node adapter to Cloudflare Pages adapter.
- **MCP tool definitions** — the tool interface design carries over, with additions (discover, find, grep, write). Transport will need adjustment for Workers.
- **CLI** — Go binary is independent of the backend platform. Needs auth token support added.

### What Changes
- **Storage layer** — replace `@aws-sdk/client-s3` R2 client with D1 database queries. This is the most significant change — the data access layer is rewritten, but the API interface stays the same.
- **Server entry point** — replace Bun's `export default { port, fetch }` with Workers `export default { fetch }`.
- **Auth layer** — new. Tenant resolution middleware, token validation against DO.
- **Durable Object class** — new. Per-tenant permissions, tokens, audit.
- **D1 schema** — new. Documents table with FTS5, user accounts, global metadata.
- **Configuration** — replace `.env` with `wrangler.toml` bindings.
- **Frontend adapter** — SvelteKit switches from `@sveltejs/adapter-node` to `@sveltejs/adapter-cloudflare` (or adapter-static served from Pages).

### Suggested Migration Sequence

1. **Set up Cloudflare project** — `wrangler.toml`, D1 database, DO binding
2. **Create D1 schema** — documents table, FTS5 index, users table
3. **Port the API** — move Hono routes to a Worker, replace R2 storage calls with D1 queries, verify list/read/metadata work
4. **Add auth layer** — D1 user table, DO token/permission class, middleware
5. **Add new endpoints** — find, grep, discover, write, move, copy
6. **Update MCP server** — add new tools, test with Claude Code/Desktop
7. **Update CLI** — add auth, find, grep, discover, read, write, mv, cp commands; add `setup` for agent platform onboarding
8. **Adapt frontend** — Cloudflare Pages adapter, login/signup, dashboard, document viewer
9. **Deploy and test** — staging environment on Cloudflare, end-to-end testing
10. **Cut over** — DNS, retire Railway services


## 10. Open Questions

- **MCP transport on Workers**: The current MCP server uses `StreamableHTTPServerTransport` with Node.js request/response conversion. Need to verify this works on Workers or find the right transport adapter.
- **Frontmatter parsing library**: Need a lightweight frontmatter parser that works in Workers' V8 runtime. `gray-matter` is the standard but may have Node.js dependencies. Alternatives: `front-matter` (npm), or a simple custom parser (the format is just YAML between `---` delimiters).
- **D1 row size limits for large documents**: Test how D1/SQLite handles very large text columns (multi-MB markdown files). May need a threshold where large documents get stored differently or chunked.
- **FTS5 query syntax exposure**: How much of SQLite's FTS5 query syntax do we expose to users/agents? Full MATCH syntax (AND, OR, NEAR, prefix*) is powerful but complex. Start with simple substring matching and add advanced syntax later?
- **D1 multi-tenancy model**: One shared database with tenant_id column, or one D1 database per tenant? Shared is simpler to manage; per-tenant is stronger isolation and avoids the 10GB shared limit. Start shared, migrate heavy tenants later?
- **Directory listing performance**: The `ls` operation requires post-processing in the Worker to partition flat paths into files and subdirectories. Profile this at scale — may need a cached `directories` table if it becomes a bottleneck.
- **SvelteKit on Cloudflare Pages**: Verify Svelte 5 / SvelteKit 2 compatibility with `adapter-cloudflare`. Check if server-side rendering works as expected with D1 bindings available in server hooks.
- **Signup and billing flow**: Self-built with Stripe, or use a service like Clerk/WorkOS for auth + Stripe for billing? Trade off build time vs. control.
- **Version retention policy**: How many versions of each document do we keep? All versions forever is simple but grows storage. A default (e.g., last 50 versions) with configurable retention may be needed.
