# @igloo/ui

igloo's design system: one set of tokens, base styles and Svelte components for every igloo surface. The instance (`instance/web`), the AppView (`appview/web`) and a future docs site all build from it, so a data dir looks the same wherever it is shown, and every deploy gets the design automatically.

Stack: Svelte 5, Tailwind v4, [Bits UI](https://bits-ui.com) for interactive primitives (dropdown menu, dialog), [Lucide](https://lucide.dev) icons.

## Using it

```css
/* src/app.css */
@import "tailwindcss";
@import "@igloo/ui/igloo.css";
```

```svelte
<script lang="ts">
  import { Shell, DataDirView, FileTable } from "@igloo/ui";
</script>
```

Add `@tailwindcss/vite` to the app's Vite plugins. `igloo.css` also tells Tailwind to scan the components, so their classes are generated.

Plain TypeScript (no Svelte) can import `@igloo/ui/format` and `@igloo/ui/types`, which is how Worker code shares formatting and model types with the pages.

## Tokens (`src/igloo.css`)

Every color, font, radius and width is a CSS variable, with light and dark values. Tailwind utilities read them: `bg-bg`, `bg-sunken`, `text-fg`, `text-muted`, `border-line`, `border-line-soft`, `bg-primary text-primary-fg`, `text-live`, `font-mono`, `rounded-control`, `max-w-reading`.

| Group  | Tokens                                                                                                                            |
| ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Color  | `--bg --surface --sunken --fg --muted --line --line-soft --primary --primary-fg --focus --live --dark --danger`                   |
| Type   | `--font-body --font-display --font-code`, and the scale `text-label text-data text-meta text-body text-title text-page text-hero` |
| Shape  | `--radius-control --radius-panel`                                                                                                 |
| Widths | `--width-page --width-reading --width-form`                                                                                       |

Pass 1 is structure only: black on white, system fonts, hairlines, plain underlined links, no accent. The visual direction changes these values, not the components or pages.

Shared classes: `.eyebrow` (small uppercase mono label), `.data` (anything from a file system: paths, sizes, hashes, times), `.input`, `.check`, `table.table` with `.num` and `.nowrap` cells inside `.table-scroll`, and `.prose` for READMEs.

## Components

| Component                                 | What it is                                                                                            |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Shell`                                   | The page frame: top bar (brand, nav, account), main, footer                                           |
| `Brand`, `NavLink`, `AccountMenu`         | Top bar parts. The account menu is the signed-in handle with a dropdown                               |
| `PageHeader`, `Section`, `Breadcrumbs`    | Page and section headings, with meta lines and an actions column                                      |
| `TabNav`                                  | Page tabs as links (shareable, server-rendered); disabled tabs reserve later features                 |
| `Stepper`                                 | Steps of a flow: 1 files › 2 details › 3 review                                                       |
| `DataDirView`                             | A published data dir: header, byline, actions, and files, README, schema, query, mirrors, record tabs |
| `FileTable`                               | Files with size, rows, format and sha256; sortable; paths wrap, numbers never do                      |
| `DataDirTable`                            | A listing of data dirs, filterable and sortable                                                       |
| `ClassicIndex`                            | The plain `Index of /` listing, the AutoIndex nod                                                     |
| `ActivityRow`                             | One feed event: status, avatar, actor, verb, data dir, instance, age                                  |
| `StatusMark`                              | The status slot: live (published, online) or dark (draft, unreachable). The lit igloo goes here       |
| `PersonLink`, `Avatar`                    | A person's handle and avatar                                                                          |
| `MetaList`                                | Key/value facts as a table                                                                            |
| `SignInForm`                              | AT Protocol sign-in: a handle and "Continue with AT Protocol"                                         |
| `Button`, `Field`, `CopyButton`, `Dialog` | Controls                                                                                              |
| `Notice`, `EmptyState`, `Loading`         | Messages and states                                                                                   |
| `Readme`, `QueryPanel`                    | A README fetched and checked against its sha256; in-browser SQL with DuckDB-WASM                      |
| `ServerSignature`                         | `igloo/0.1 Server at <host> Port 443`                                                                 |

## Rules

- Records and READMEs come from other people. Render record fields as text. READMEs go through `renderMarkdown`, which escapes raw HTML and drops unsafe links.
- Monospace and tabular numbers for anything from a file system.
- Features from later phases (mirrors, follows, likes, liveness) keep their place in the layout, shown disabled or marked "later", so adding them doesn't move anything.
