# ❄ igloo

**Personal data spaces, joined by AT Protocol.**

Everyone hosts their own datasets on their own Cloudflare account. A shared AppView lets people find them. Think of the directory listings early ML research shared datasets from, plus decentralized identity and an API agents can use.

## Two layers

```
  instances (one per owner, self-deployed)            the shared social layer
 ┌──────────────────────────┐   publish    ┌─────┐   Jetstream  ┌───────────────────┐
 │ alice's igloo (R2 + D1)  │────record───▶│ PDS │─────────────▶│ AppView           │
 └──────────────────────────┘              └─────┘              │  feed · search    │
 ┌──────────────────────────┐   publish    ┌─────┐              │  data dir pages   │
 │ bob's igloo              │────record───▶│ PDS │─────────────▶│  maintainers      │
 └──────────────────────────┘              └─────┘              └───────────────────┘
        ▲  data files are downloaded straight from each instance, never from the AppView
```

**Instances: the decentralized network.** Each owner deploys their own instance into their own Cloudflare account. Files live in the owner's R2 bucket; the instance serves a public listing, downloads, an admin panel, a REST API and an MCP endpoint. The unit of content is a **data dir**: data files, a README and a license, each file hashed with sha256. Nobody else hosts your data, and you can leave at any time.

**The AppView: the shared social layer.** Publishing a data dir writes a small `dataDir` record to the owner's AT Protocol repo (their PDS). The record describes the data and points at the instance; it never contains it. The AppView reads those records from the network and serves one feed across every instance, with search and pages for each data dir, instance and maintainer. It never stores or proxies data files.

Identity is your AT Protocol account (Bluesky or any PDS), so there are no igloo accounts. In the browser, DuckDB queries files straight from an instance, reading only the byte ranges it needs. No igloo server runs a query.

## Run your own

You need [Bun](https://bun.sh) and a [Cloudflare](https://cloudflare.com) account (the free plan works).

```bash
bun create igloo my-igloo
```

That signs you in to Cloudflare, asks for a Worker name, an R2 bucket, a title and an optional custom domain, and deploys. Open `/admin` on your instance and sign in with your AT Protocol handle and the setup code it printed. That account becomes the owner.

`my-igloo` is your instance: its settings (`igloo.config.json`) plus a dependency on [`@igloo-data/instance`](https://www.npmjs.com/package/@igloo-data/instance). Keep it as a git repo. To update igloo, run `bun update @igloo-data/instance && bun run deploy`. **Example:** [cldixon/cldixon-igloo](https://github.com/cldixon/cldixon-igloo) deploys [data.cldixon.dev](https://data.cldixon.dev).

Then, in the admin panel: create a data dir, add files, write a README, pick a license, and **Publish**. It shows up on the [feed](https://igloo.cldixon.dev) within seconds.

## Status

This is a working prototype. Records use the `dev.cldixon.igloo.*` namespace and the AppView runs at [igloo.cldixon.dev](https://igloo.cldixon.dev); both move to `social.igloo.*` / `igloo.social` at a planned reset, and everything published before then is wiped. The design is in the [igloo Network Design](https://claude.ai/artifact/HMW8j1kyFnSLYmxThUVDPz).

## This repo

| Path                    | What                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `instance/`             | The instance Worker and its UI, released as `@igloo-data/instance`                  |
| `appview/`              | The AppView Worker                                                                  |
| `packages/`             | The lexicon, shared Worker plumbing, the in-browser query panel, and `create-igloo` |
| `cli/`, `skills/igloo/` | A Go CLI and an agent skill                                                         |

```bash
bun install && bun run check   # everything CI runs
```

[docs/reference.md](docs/reference.md) has the configuration, API, MCP tools, CLI and release process. [docs/runbook.md](docs/runbook.md) covers deploying and testing the network.

MIT licensed.
