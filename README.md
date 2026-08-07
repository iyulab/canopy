# Canopy

> Your markdown tree, blooming into a static site on the web.

**Canopy** is a publishing renderer that turns a tree of markdown notes into a static website.
It maps your folder structure into navigation, the links between your notes into hyperlinks, and
frontmatter into metadata, producing a **deployable site bundle in a single build**.

Just as a tree's canopy is the layer seen from the outside, Canopy renders the **public face** of your note tree.

---

## What it does

- **Input** — markdown + frontmatter + folder tree
- **Output** — a static site bundle (HTML · assets · navigation · backlink graph · per-page
  outline · site shell)
- **Stateless build** — the same input always yields the same output

## Design principles

- **App-agnostic.** It knows nothing about any specific note app's internal format or hidden config
  directory. It only accepts the generic contract "markdown + frontmatter + tree", so any tool that
  wants publishing can use it.
- **Read-only, one-way.** The source is the user's local files; the published output is a derivative.
  Canopy never touches the source.
- **Self-hostable.** Being open source (MIT), you can render it yourself and deploy anywhere
  (GitHub Pages, Cloudflare Pages, etc.).

Canopy is a shared core with more than one consumer, so the boundary around it is load-bearing.
[docs/SCOPE.md](docs/SCOPE.md) states what canopy owns, what it deliberately leaves to its callers,
and the test for deciding which side a proposed feature falls on — worth reading before opening a
feature request. [CONTRIBUTING.md](CONTRIBUTING.md) covers development; [CHANGELOG.md](CHANGELOG.md)
tracks what changed.

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
- `--site-description <text>` — fill `<meta name="description">`, used by link previews.
- `--lang <tag>` — BCP 47 language tag for `<html lang>` (defaults to `en`). Worth setting for
  any non-English vault: assistive technology reads pronunciation rules from it.
- `--site-icon <path>` — vault-relative favicon, linked from every page. Linked relatively, so
  it resolves from a sub-path — where the browser's implicit `/favicon.ico` guess fails. The
  build fails if the path is missing or excluded, rather than shipping a broken link.
- `--tokens-css <path>` — inject a CSS file of design tokens (written as `tokens.css`) so the
  published site matches a host app's theme. Without it, canopy's built-in tokens are used.
- `--exclude <pattern>` — leave part of the vault unpublished. Repeatable. Accepts a directory
  (`drafts` or `drafts/**`, matching it and everything beneath), an extension at any depth
  (`*.tmp`), or one exact path (`notes/scratch.md`). Applies to markdown and assets alike.
- `--nav <path>` — a JSON file giving the navigation order and labels (see below). Without it,
  navigation is derived from the folder structure.

### Page names

A page is called by the name it gives itself, in this order:

```
frontmatter title  →  the opening h1  →  the filename
```

That one name reaches every place a page is named: the sidebar entry, the `<title>`, and the text
of each backlink pointing at it. A document opening with `# Order list` is called "Order list"
without a `title:` line, which matters most where filenames are ASCII identifiers and the prose is
not — the alternative is a sidebar in one language and documents in another.

A folder's `index` page names the folder it opens, since the two are one entry in the sidebar. A
page that names itself nowhere keeps its filename, and an index page that names itself nowhere is
called after what it opens — the site's front, or its folder.

### Navigation

By default the sidebar follows the folder structure: folders before pages, each alphabetical by
the name above, folder labels taken from directory names. That suits a vault with no order of its
own.

`--nav` supplies one where there is. Array order is display order — nothing is re-sorted — and
a label overrides the directory name a URL happens to use:

```json
{
  "items": [
    { "label": "Home", "path": "index.md" },
    { "label": "Guide", "items": [
      { "path": "guide/install" },
      { "path": "guide/first-steps" }
    ]},
    { "label": "Release notes", "path": "releases/index.md", "items": [
      { "path": "releases/2026-08" },
      { "path": "releases/2026-04" }
    ]}
  ]
}
```

An item is a page (`path`) or a group (`items`); a group may carry both, which makes its label
link to that page. Paths may be written with or without an extension. `label` is optional and
falls back to the page's own name (see above) — so a spec only has to name what it wants to
override.

Pages the spec omits are left out of the navigation and reported, rather than dropped silently
or appended: whether an omission is deliberate is yours to decide, not canopy's. A spec that is
malformed fails the build, naming the position.

Markdown files become `.html`; every other file (images, etc.) is copied alongside, mirroring the
folder layout. Dot-prefixed directories (`.git`, editor and note-app config directories, build
caches) are skipped, along with `node_modules`. KaTeX styles and fonts are bundled into `assets/`
so math renders without a network dependency.

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
  nav?: NavSpec;   // optional order and labels; see Navigation above
}
```

There is no pre-built tree, no app-specific metadata, and no hidden config. Without `nav` the
hierarchy is derived from the document paths alone; `nav` supplies an order for document sets that
have one, and says nothing about where that order came from. The build produces:

```ts
interface SiteBundle {
  pages: RenderedPage[];   // { sourcePath, sitePath, frontmatter, html, backlinks, outline }
  navigation: NavNode[];   // from `nav` when given, else derived from the paths
  navReport?: AppliedNav;  // pages a spec omitted, spec paths that matched nothing
}
```

Each page also carries an `outline` — its `h2`/`h3` headings with the ids the body already uses,
which the shell renders as an on-this-page contents list. Pages with fewer than two headings get
none, since a one-line contents list says nothing the page does not already show.

### Markdown support

- CommonMark + GitHub Flavored Markdown (tables, strikethrough, task lists, autolinks)
- Math with KaTeX (`$inline$` and `$$display$$`) — see the deliberate deviations below
- Syntax highlighting with Shiki (light/dark dual theme via `prefers-color-scheme`). Grammars load
  on demand, so a build pays only for the languages its notes actually use. A fence naming a
  language canopy cannot resolve renders as a plain code block, exactly as an unlabelled fence
  does — a typo in a fence never fails a build.
- Wikilinks: `[[note]]`, `[[note|alias]]`, `[[note#heading]]` — resolved tree-wide to relative links,
  with a backlink graph. Unresolved links degrade to plain text.
- Markdown links to other notes (`[text](note.md)`, including the reference-style
  `[text][id]` form) resolve the same way, relative to the linking document, and count in the
  backlink graph. Absolute URLs, root-absolute paths (`/help/x.png`), bare fragments, and
  targets that were not published are left exactly as written.
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
