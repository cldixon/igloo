import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { DUCKDB_CDN, QUERY_PANEL_CSS, loadDuckDB, mountQueryPanel, queryFiles } from "@igloo/query";
import type { IndexedDataDir, IndexedInstance, Maintainer } from "./db.js";

/**
 * Server-rendered pages. Every interpolation through `html` is escaped;
 * record contents come from other people's repos and are untrusted.
 */

type Html = HtmlEscapedString | Promise<HtmlEscapedString>;

export type Viewer = { did: string; handle: string | null } | null;

const STYLES = `
:root {
  --bg: #f3f6f8; --surface: #fff; --sunken: #e8eef2; --fg: #13212c; --muted: #566775;
  --line: #c9d5de; --data: #1d6a9a; --data-soft: #dceaf4; --proto: #b0701c; --proto-soft: #f6e8d3;
  --display: "Bricolage Grotesque", "Avenir Next", "Segoe UI", sans-serif;
  --body: "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0c141a; --surface: #121d25; --sunken: #0f1920; --fg: #dbe6ed; --muted: #8fa2b0;
    --line: #26363f; --data: #6db4e0; --data-soft: #15303f; --proto: #e2a85c; --proto-soft: #3a2a14;
    color-scheme: dark;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.6 var(--body); }
a { color: var(--data); text-decoration: none; }
a:hover { text-decoration: underline; }
code, .mono { font-family: var(--mono); font-size: 0.86em; overflow-wrap: anywhere; }
.wrap { max-width: 920px; margin: 0 auto; padding: 0 16px; }
header.site { border-bottom: 1px solid var(--line); background: var(--surface); }
header.site .wrap { display: flex; align-items: center; gap: 16px; padding-block: 12px; flex-wrap: wrap; }
.brand { font-family: var(--display); font-weight: 700; font-size: 1.35rem; color: var(--fg); letter-spacing: -0.01em; }
.brand:hover { text-decoration: none; }
.tagline { color: var(--muted); font-size: 0.9rem; }
.spacer { flex: 1; }
.who { font-size: 0.9rem; color: var(--muted); display: flex; gap: 10px; align-items: center; }
.who form { margin: 0; }
button, .btn { font: inherit; font-size: 0.85rem; border: 1px solid var(--line); background: var(--surface); color: var(--fg); border-radius: 6px; padding: 4px 12px; cursor: pointer; }
main { padding-block: 32px 64px; display: grid; gap: 24px; }
h1, h2, h3 { font-family: var(--display); line-height: 1.15; margin: 0; text-wrap: balance; }
h1 { font-size: clamp(1.8rem, 5vw, 2.6rem); letter-spacing: -0.02em; }
h2 { font-size: 1.25rem; }
.muted { color: var(--muted); }
.eyebrow { font-family: var(--mono); font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.feed { display: grid; gap: 12px; }
.item { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 16px 18px; display: grid; gap: 6px; }
.item h2 a { color: var(--fg); }
.meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; font-size: 0.85rem; color: var(--muted); }
.avatar { width: 22px; height: 22px; border-radius: 50%; vertical-align: middle; background: var(--sunken); object-fit: cover; }
.avatar.big { width: 64px; height: 64px; }
.facts { font-family: var(--mono); font-size: 0.8rem; color: var(--muted); display: flex; flex-wrap: wrap; gap: 4px 14px; }
.chip { font-family: var(--mono); font-size: 0.72rem; padding: 0 8px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); }
.panel { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 18px; display: grid; gap: 12px; min-width: 0; }
.autoindex h3 { font-family: "Times New Roman", Times, serif; font-size: 1.45rem; font-weight: 700; }
.listing { overflow-x: auto; }
.listing table { border-collapse: collapse; width: 100%; font-family: var(--mono); font-size: 0.82rem; min-width: 560px; }
.listing th, .listing td { text-align: left; padding: 4px 10px 4px 0; white-space: nowrap; }
.listing th { color: var(--muted); font-weight: 400; border-bottom: 1px solid var(--line); }
.listing td.num { text-align: right; }
.record { color: var(--proto); font-family: var(--mono); font-size: 0.8rem; overflow-wrap: anywhere; }
address { font-family: "Times New Roman", Times, serif; font-style: italic; font-size: 0.85rem; color: var(--muted); }
pre.readme { white-space: pre-wrap; font-family: var(--mono); font-size: 0.82rem; margin: 0; background: var(--sunken); border-radius: 6px; padding: 14px; max-height: 32rem; overflow: auto; }
.verify { font-family: var(--mono); font-size: 0.78rem; }
.verify.ok { color: var(--data); }
.verify.bad { color: #c0392b; }
.note { border-left: 3px solid var(--proto); background: var(--proto-soft); padding: 10px 14px; border-radius: 0 6px 6px 0; font-size: 0.92rem; }
.profile { display: flex; gap: 16px; align-items: center; }
form.login { display: grid; gap: 10px; max-width: 26rem; }
form.login input { font: inherit; padding: 8px 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); color: var(--fg); }
.empty { padding: 32px; text-align: center; color: var(--muted); border: 1px dashed var(--line); border-radius: 8px; }
footer { border-top: 1px solid var(--line); color: var(--muted); font-size: 0.82rem; padding-block: 16px; }
`;

const FONTS =
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap";

export function layout(title: string, viewer: Viewer, body: Html): Html {
  return html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link rel="stylesheet" href="${FONTS}" />
        <style>
          ${raw(STYLES)}
        </style>
      </head>
      <body>
        <header class="site">
          <div class="wrap">
            <a class="brand" href="/">❄ igloo</a>
            <span class="tagline">personal data spaces, on AT Protocol</span>
            <span class="spacer"></span>
            <span class="who">
              ${
                viewer
                  ? html`<span
                        >signed in as ${viewer.handle ? `@${viewer.handle}` : viewer.did}</span
                      >
                      <form method="post" action="/logout"><button>Sign out</button></form>`
                  : html`<a class="btn" href="/login">Sign in</a>`
              }
            </span>
          </div>
        </header>
        <main class="wrap">${body}</main>
        <footer>
          <div class="wrap">
            igloo AppView · indexes <code>dev.cldixon.igloo.*</code> records · never stores or
            proxies data files
          </div>
        </footer>
      </body>
    </html>`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["K", "M", "G", "T"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)}${units[unit]}`;
}

function date(iso: string): string {
  return iso.slice(0, 10);
}

function host(url: string): string {
  return new URL(url).host;
}

export const dataDirPath = (d: { did: string; rkey: string }) => `/d/${d.did}/${d.rkey}`;
export const instancePath = (did: string, url: string) => `/i/${did}/${host(url)}`;
export const maintainerPath = (did: string) => `/m/${did}`;

/** A data file's download URL on its instance. */
export function downloadUrl(instance: string, name: string, path: string): string {
  return `${instance}/api/download?path=${encodeURIComponent(`${name}/${path}`)}`;
}

function maintainerLink(did: string, m: Maintainer | undefined | null): Html {
  return html`<a href="${maintainerPath(did)}"
    >${m?.avatar ? html`<img class="avatar" src="${m.avatar}" alt="" /> ` : ""}${
      m?.handle ? `@${m.handle}` : did
    }</a
  >`;
}

function feedItem(
  d: IndexedDataDir,
  maintainer: Maintainer | undefined,
  instance: IndexedInstance | undefined,
): Html {
  const r = d.record;
  const size = r.files.reduce((sum, f) => sum + f.size, 0);
  return html`<article class="item">
    <div class="meta">
      ${maintainerLink(d.did, maintainer)} <span>·</span>
      <a href="${instancePath(d.did, d.instanceUrl)}"
        >${instance?.record.name ?? host(d.instanceUrl)}</a
      >
      <span>·</span> <span>${date(r.createdAt)}</span>
    </div>
    <h2><a href="${dataDirPath(d)}">${r.title ?? r.name}</a></h2>
    ${r.description ? html`<p class="muted" style="margin:0">${r.description}</p>` : ""}
    <div class="facts">
      <span>${r.name}/</span>
      <span>${r.files.length} file${r.files.length === 1 ? "" : "s"}</span>
      <span>${formatBytes(size)}</span>
      ${r.license ? html`<span>${r.license}</span>` : ""}
    </div>
  </article>`;
}

export function feedPage(
  viewer: Viewer,
  items: IndexedDataDir[],
  maintainers: Map<string, Maintainer>,
  instances: Map<string, IndexedInstance>,
  next: string | null,
): Html {
  return layout(
    "igloo",
    viewer,
    html`<div style="display:grid;gap:8px">
        <span class="eyebrow">Recently published</span>
        <h1>Data dirs on the network</h1>
        <p class="muted" style="margin:0">
          Data lives on each owner's own igloo instance. This page only indexes the records that
          announce it.
        </p>
      </div>
      ${
        items.length === 0
          ? html`<div class="empty">Nothing published yet.</div>`
          : html`<div class="feed">
              ${items.map((d) =>
                feedItem(d, maintainers.get(d.did), instances.get(`${d.did} ${d.instanceUrl}`)),
              )}
            </div>`
      }
      ${next ? html`<a href="/?before=${encodeURIComponent(next)}">Older →</a>` : ""}`,
  );
}

/** Client-side: fetch the README from the instance and check it against the record's hash. */
const README_SCRIPT = `
(async () => {
  const el = document.getElementById("readme");
  if (!el) return;
  const status = document.getElementById("readme-status");
  try {
    const res = await fetch(el.dataset.src);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
      .map((b) => b.toString(16).padStart(2, "0")).join("");
    el.textContent = new TextDecoder().decode(bytes);
    const ok = digest === el.dataset.sha256;
    status.textContent = ok ? "✓ matches the hash in the record" : "✗ doesn't match the hash in the record";
    status.className = "verify " + (ok ? "ok" : "bad");
  } catch (e) {
    el.textContent = "Couldn't load the README from the instance (" + e.message + ").";
  }
})();
`;

export function dataDirPage(
  viewer: Viewer,
  d: IndexedDataDir,
  maintainer: Maintainer | null,
  instance: IndexedInstance | null,
): Html {
  const r = d.record;
  const total = r.files.reduce((sum, f) => sum + f.size, 0);
  return layout(
    `${r.title ?? r.name} · igloo`,
    viewer,
    html`<div style="display:grid;gap:10px">
        <span class="eyebrow">Data dir</span>
        <h1>${r.title ?? r.name}</h1>
        ${r.description ? html`<p style="margin:0">${r.description}</p>` : ""}
        <div class="meta">
          ${maintainerLink(d.did, maintainer)} <span>·</span>
          <a href="${instancePath(d.did, d.instanceUrl)}"
            >${instance?.record.name ?? host(d.instanceUrl)}</a
          >
          <span>·</span> <span>published ${date(r.createdAt)}</span>
          ${r.license ? html`<span class="chip">${r.license}</span>` : ""}
        </div>
      </div>

      <section class="panel autoindex">
        <h3>Index of /${r.name}</h3>
        <div class="listing">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Rows</th>
                <th>sha256</th>
              </tr>
            </thead>
            <tbody>
              ${r.files.map(
                (f) =>
                  html`<tr>
                    <td><a href="${downloadUrl(d.instanceUrl, r.name, f.path)}">${f.path}</a></td>
                    <td class="num">${formatBytes(f.size)}</td>
                    <td class="num">${f.rows != null ? f.rows.toLocaleString("en-US") : "-"}</td>
                    <td title="${f.sha256}">${f.sha256}</td>
                  </tr>`,
              )}
            </tbody>
          </table>
        </div>
        <div class="record">[${d.uri}]<br />[cid ${d.cid}]</div>
        <address>
          ${r.files.length} file${r.files.length === 1 ? "" : "s"}, ${formatBytes(total)} · served
          by <a href="${d.instanceUrl}/${r.name}">${host(d.instanceUrl)}</a>
        </address>
      </section>

      <p class="note">
        Files download straight from the owner's instance. Check a download against the record with
        <code>sha256sum &lt;file&gt;</code>.
      </p>

      ${
        r.tags?.length
          ? html`<div class="meta">
              ${r.tags.map((t) => html`<a class="chip" href="/search?q=${encodeURIComponent(`tag:${t}`)}">${t}</a>`)}
            </div>`
          : ""
      }
      ${schemaSection(r.files)} ${querySection(d)}
      ${
        r.readme
          ? html`<section class="panel">
              <div style="display:flex;gap:12px;align-items:baseline;flex-wrap:wrap">
                <h2>README</h2>
                <span id="readme-status" class="verify muted">checking…</span>
              </div>
              <pre
                class="readme"
                id="readme"
                data-src="${downloadUrl(d.instanceUrl, r.name, r.readme.path)}"
                data-sha256="${r.readme.sha256}"
              >
Loading…</pre>
              <script>
                ${raw(README_SCRIPT)};
              </script>
            </section>`
          : ""
      }`,
  );
}

function schemaSection(files: IndexedDataDir["record"]["files"]): Html {
  const described = files.filter((f) => f.schema && f.schema.length > 0);
  if (described.length === 0) return html``;
  return html`<section class="panel">
    <h2>Schema</h2>
    <p class="muted" style="margin:0">Measured from the files themselves.</p>
    ${described.map(
      (f) =>
        html`<details ${described.length === 1 ? "open" : ""}>
          <summary>
            <code>${f.path}</code>
            <span class="muted"
              >· ${f.format ?? ""} · ${f.schema!.length}
              columns${f.rows != null ? ` · ${f.rows.toLocaleString("en-US")} rows` : ""}</span
            >
          </summary>
          <div class="listing">
            <table>
              <tbody>
                ${f.schema!.map(
                (c) =>
                  html`<tr>
                    <td>
                      <a href="/search?q=${encodeURIComponent(`col:${c.name}`)}">${c.name}</a>
                    </td>
                    <td class="muted">${c.type}</td>
                  </tr>`,
              )}
              </tbody>
            </table>
          </div>
        </details>`,
    )}
  </section>`;
}

/**
 * JSON for a <script> block: escaping "<" means no value (a file path, say)
 * can close the script element early.
 */
function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** In-browser SQL over the data dir's files: DuckDB-WASM reading straight from the instance. */
function querySection(d: IndexedDataDir): Html {
  const files = queryFiles(d.record.files, (path) =>
    downloadUrl(d.instanceUrl, d.record.name, path),
  );
  if (files.length === 0) return html``;
  return html`<section class="panel">
    <h2>Query</h2>
    <div id="query"></div>
    <style>
      ${raw(QUERY_PANEL_CSS)}
    </style>
    <script type="module">
      // Wrangler's bundler names functions through a __name helper; these
      // functions are shipped as source, so give them a no-op one.
      const __name = (f) => f;
      const loadDuckDB = ${raw(loadDuckDB.toString())};
      const mountQueryPanel = ${raw(mountQueryPanel.toString())};
      mountQueryPanel(
        document.getElementById("query"),
        ${raw(scriptJson({ files, duckdb: DUCKDB_CDN }))},
        loadDuckDB,
      );
    </script>
  </section>`;
}

function dataDirList(items: IndexedDataDir[]): Html {
  if (items.length === 0) return html`<div class="empty">No published data dirs.</div>`;
  return html`<div class="feed">
    ${items.map(
      (d) =>
        html`<article class="item">
          <h2><a href="${dataDirPath(d)}">${d.record.title ?? d.record.name}</a></h2>
          ${d.record.description ? html`<p class="muted" style="margin:0">${d.record.description}</p>` : ""}
          <div class="facts">
            <span>${d.record.name}/</span><span>${d.record.files.length} files</span
            ><span>${date(d.record.createdAt)}</span>
          </div>
        </article>`,
    )}
  </div>`;
}

export function instancePage(
  viewer: Viewer,
  instance: IndexedInstance,
  maintainer: Maintainer | null,
  items: IndexedDataDir[],
): Html {
  return layout(
    `${instance.record.name} · igloo`,
    viewer,
    html`<div style="display:grid;gap:10px">
        <span class="eyebrow">Instance</span>
        <h1>${instance.record.name}</h1>
        ${instance.record.description ? html`<p style="margin:0">${instance.record.description}</p>` : ""}
        <div class="meta">
          <a href="${instance.url}">${host(instance.url)}</a> <span>·</span>
          ${maintainerLink(instance.did, maintainer)}
        </div>
        <div class="record">[${instance.uri}]</div>
      </div>
      <h2>Data dirs</h2>
      ${dataDirList(items)}`,
  );
}

export function maintainerPage(
  viewer: Viewer,
  did: string,
  maintainer: Maintainer | null,
  instances: IndexedInstance[],
  items: IndexedDataDir[],
): Html {
  const name = maintainer?.displayName || (maintainer?.handle ? `@${maintainer.handle}` : did);
  return layout(
    `${name} · igloo`,
    viewer,
    html`<div class="profile">
        ${maintainer?.avatar ? html`<img class="avatar big" src="${maintainer.avatar}" alt="" />` : ""}
        <div style="display:grid;gap:4px">
          <span class="eyebrow">Maintainer</span>
          <h1>${name}</h1>
          <span class="muted"
            >${maintainer?.handle ? html`@${maintainer.handle} · ` : ""}<code>${did}</code></span
          >
        </div>
      </div>
      ${maintainer?.description ? html`<p style="margin:0">${maintainer.description}</p>` : ""}
      <h2>Instances</h2>
      ${
        instances.length === 0
          ? html`<div class="empty">No instance records.</div>`
          : html`<div class="feed">
              ${instances.map(
                (i) =>
                  html`<article class="item">
                    <h2><a href="${instancePath(i.did, i.url)}">${i.record.name}</a></h2>
                    <div class="facts"><a href="${i.url}">${host(i.url)}</a></div>
                  </article>`,
              )}
            </div>`
      }
      <h2>Data dirs</h2>
      ${dataDirList(items)}`,
  );
}

export function loginPage(viewer: Viewer, error?: string): Html {
  return layout(
    "Sign in · igloo",
    viewer,
    html`<h1>Sign in</h1>
      <p class="muted" style="margin:0">
        Sign in with your AT Protocol account (Bluesky or any PDS). igloo only asks to know who you
        are; it can't post or change anything in your account.
      </p>
      <form class="login" method="post" action="/login">
        <input name="handle" placeholder="you.bsky.social" autocomplete="username" required />
        ${error ? html`<p class="verify bad" style="margin:0">${error}</p>` : ""}
        <button>Sign in</button>
      </form>`,
  );
}

export function notFoundPage(viewer: Viewer, what: string): Html {
  return layout(
    "Not found · igloo",
    viewer,
    html`<h1>Not found</h1>
      <p class="muted">${what} isn't in the index. It may have been unpublished.</p>
      <a href="/">Back to the feed</a>`,
  );
}
