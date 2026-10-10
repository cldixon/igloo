# @igloo-data/instance

The [igloo](https://github.com/cldixon/igloo) instance: a self-hosted data space on Cloudflare (R2, D1 and a Worker), joined to the igloo network by AT Protocol.

Start one with:

```bash
bun create igloo my-igloo
```

That makes a folder with your settings (`igloo.config.json`) and this package as a dependency, and walks you through setup. Inside it:

| Command           | What it does                                                                       |
| ----------------- | ---------------------------------------------------------------------------------- |
| `bun run setup`   | Ask for your settings, create the R2 bucket, write `igloo.config.json`             |
| `bun run deploy`  | Deploy the Worker. The first deploy also prints the setup code that claims it      |
| `bun run dev`     | Run the instance locally on http://127.0.0.1:8787 (`-- --local` for a fake bucket) |
| `bun run secrets` | Replace the setup code and OAuth key (before claiming only)                        |

To update, bump this package's version and deploy again. Migrations apply themselves.

The package ships a prebuilt Worker bundle and web UI; see the igloo repo for the source.
