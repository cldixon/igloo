# @igloo/instance-web

The instance's web UI: a client-rendered SvelteKit SPA served by Workers Static Assets, built from the shared design system in `packages/ui`.

- `/` and `/<data dir>`: the public index and data dir pages (`?view=classic`, `?tab=`).
- `/admin`: sign-in (or claiming a new instance with its setup code) and the data dirs list; `/admin/new` and `/admin/d/<name>` for files, details and publishing; `/admin/settings`.

Run it with `bun run dev` in `instance/` (Worker on :8787, this UI on :5173). See the repository README.
