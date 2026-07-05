# Canopy

> Your markdown tree, blooming into a static site on the web.

**Canopy** is a publishing renderer that turns a tree of markdown notes into a static website.
It maps your folder structure into navigation, wikilinks into hyperlinks, and frontmatter into metadata,
producing a **deployable site bundle in a single build**.

Just as a tree's canopy is the layer seen from the outside, Canopy renders the **public face** of your note tree.

---

## What it does

- **Input** — markdown + frontmatter + folder tree
- **Output** — a static site bundle (HTML · assets · navigation · backlink graph · site shell)
- **Stateless build** — the same input always yields the same output

## Design principles

- **App-agnostic.** It knows nothing about any specific note app's internal format or hidden config
  directory. It only accepts the generic contract "markdown + frontmatter + tree", so any tool that
  wants publishing can use it.
- **Read-only, one-way.** The source is the user's local files; the published output is a derivative.
  Canopy never touches the source.
- **Self-hostable.** Being open source (MIT), you can render it yourself and deploy anywhere
  (GitHub Pages, Cloudflare Pages, etc.).

---

## Install

```sh
npm install @iyulab/canopy
```

## CLI

Build a folder of markdown into a static site:

```sh
npx canopy build <vault-dir> [out-dir] [options]
```

- `<vault-dir>` — the folder of markdown notes to publish.
- `[out-dir]` — where to write the site bundle (defaults to `./site`).
- `--site-title <title>` — override the site title (defaults to the vault folder name).
- `--tokens-css <path>` — inject a CSS file of design tokens (written as `tokens.css`) so the
  published site matches a host app's theme. Without it, canopy's built-in tokens are used.

Markdown files become `.html`; every other file (images, etc.) is copied alongside, mirroring the
folder layout. Hidden directories (`.git`, `.obsidian`, `.textree`, …) are skipped. KaTeX styles and
fonts are bundled into `assets/` so math renders without a network dependency.

## Library API

```ts
import { build, emitSite } from "@iyulab/canopy";

const bundle = await build({
  documents: [
    { path: "index.md", content: "# Home\n\nSee [[notes/idea]]." },
    { path: "notes/idea.md", content: "---\ntitle: Idea\n---\n# Idea" },
  ],
});

// Semantic bundle: pages (HTML body, frontmatter, backlinks) + navigation tree.
console.log(bundle.navigation);

// Turn the bundle into writable files (full HTML documents + stylesheets).
const files = emitSite(bundle, { siteTitle: "My Notes" });
//   -> [{ path: "index.html", contents: "<!doctype html>…" }, …]
```

`build()` is a pure transform with no filesystem access; `emitSite()` renders the site shell. The CLI
is the thin IO layer on top — read a folder, `build`, `emitSite`, write the files.

---

## Input / output contract

Canopy is intentionally decoupled from any source app. It accepts only this generic shape:

```ts
interface SourceDocument {
  path: string;    // POSIX path relative to the vault root, e.g. "notes/idea.md"
  content: string; // raw markdown, including any leading frontmatter block
}
interface SourceTree {
  documents: SourceDocument[];
}
```

There is no pre-built tree, no app-specific metadata, and no hidden config — the hierarchy is derived
from the document paths alone. The build produces:

```ts
interface SiteBundle {
  pages: RenderedPage[]; // { sourcePath, sitePath, frontmatter, html, backlinks }
  navigation: NavNode[]; // folder/page tree derived from the paths
}
```

### Markdown support

- CommonMark + GitHub Flavored Markdown (tables, strikethrough, task lists, autolinks)
- Math with KaTeX (`$inline$` and `$$display$$`) — see the deliberate deviations below
- Syntax highlighting with Shiki (light/dark dual theme via `prefers-color-scheme`)
- Wikilinks: `[[note]]`, `[[note|alias]]`, `[[note#heading]]` — resolved tree-wide to relative links,
  with a backlink graph. Unresolved links degrade to plain text.
- Raw HTML is sanitized: safe authoring tags survive, scripts and injection vectors are stripped.

#### Math: a conservative subset of remark-math

Canopy narrows vanilla remark-math in two deliberate ways, so prose about money never silently
becomes a formula and display intent survives publishing:

- **Currency-safe inline math.** A `$..$` span is *not* math when the opening `$` is followed by
  whitespace, the closing `$` is preceded by whitespace, or the closing `$` is immediately followed
  by a digit. Vanilla remark-math renders `costs $5 and $10 total` with "5 and " as a formula;
  canopy keeps it literal text. Escaping follows backslash-run parity (`\$` is literal, `\\$x$` is a
  backslash then math).
- **Standalone `$$..$$` lines are display math.** remark-math only treats the fenced
  `$$` … `$$` (delimiters on their own lines) form as display and reads a single `$$x+y$$` line as
  *inline* math. Canopy promotes a paragraph consisting solely of standalone `$$..$$` lines to
  display blocks — matching what the author meant and how conservative line-based editors render it.
  A `$$..$$` mixed into a sentence stays inline.

The exact tokenization (including known edge divergences from line-based editor scanners) is pinned
by `src/math-parity.golden.json`; downstream editors keep a byte-identical copy and assert the
`editor` column against their scanner, so both sides of the parity move only on purpose.

### Callouts

Top-level blockquotes that open with the `> [!type]` convention render as
styled callouts:

```md
> [!tip] Optional title
> Body in regular markdown.
```

Five core styles ship: `note`, `tip`, `warning`, `danger`, `quote`. Common
aliases map onto them (`info` → note, `error` → danger, …) and unknown types
fall back to `note`, so nothing breaks. The displayed title is the text after
the marker, or the typed word itself. Fold suffixes (`[!type]-` / `[!type]+`)
are accepted and ignored — content is always visible. Nested blockquotes stay
plain quotes. Recognition semantics are pinned in
`src/callout-parity.golden.json`; downstream editors keep a byte-identical
copy to stay aligned.

### Theming

The output reads a small set of CSS custom properties (see `tokens.css` in the output, or
`CANOPY_TOKENS`). A consuming app can inject its own design tokens via `emitSite(bundle, { tokens })`
so the published site matches the app exactly — the same tokens, two surfaces.

---

## Self-hosting

The output of `canopy build` is a plain static site — host it anywhere:

**GitHub Pages**

```sh
npx canopy build ./my-vault ./site
# commit ./site to a `gh-pages` branch, or point Pages at it
```

For project pages served from `/<repo>/`, no extra config is needed: every internal link is relative,
so the site works from any sub-path.

**Cloudflare Pages / Netlify / any static host**

Point the host at the build output directory (`./site`). No server, no database, no build step beyond
`canopy build`.

---

## Development

```sh
npm install
npm run check   # type-check (tsc)
npm run lint    # Biome
npm test        # vitest
npm run build   # emit dist/
```

## License

MIT

---

*Canopy — the public face of your notes.*
