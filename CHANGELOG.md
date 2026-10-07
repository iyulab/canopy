# Changelog

Notable changes to canopy. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Canopy is a shared core with more than one consumer, so this file is part of its contract:
what changed in the rendering, the CLI surface, or the theming vocabulary is what callers
plan their upgrades around. Entries describe changes in canopy's own terms — never in terms
of a particular consuming project (see [docs/SCOPE.md](docs/SCOPE.md)).

## [Unreleased]

### Changed

- `featuredProblems` returns `FeaturedProblem` objects (`{ dir, path, message }` — the stream
  folder as the layout keys it, the entry, and what is wrong) instead of messages that named the
  layout's own keys, so a caller that writes the layout from its own configuration reports each in
  that configuration's terms.

## [0.27.0] — 2026-10-07

Upgrading: a stream post now ends with what to read next (`.canopy-read-next`) — style or hide it
with that hook. `tagProblems` returns `{ sitePath, message }` objects instead of strings.

### Added

- What to read next: a page's `readNext:` (a path written as a markdown link from the page, or a
  `"[[wikilink]]"`; one, or a list) closes the article as a list (`.canopy-read-next`) of each named
  page with its date and summary, on any page. A stream's post always has the list, filled to three
  with the posts sharing its rarer tags or linked with it (`ln(N / df)` per shared tag, 1 for a
  link either way), then the stream's newest. Titled by `strings.readNext` ("Read next") when the
  author named any, `strings.related` ("Related posts") otherwise. Exported: `pickReadNext`,
  `relatedPosts`, `resolveReadNext`, `readNextValues`, `readNextProblems` (a value naming no page,
  by the page), `READ_NEXT_SLOTS`, and the `LinkIndex` type.
- Featured posts: a stream rule's `featured` (vault paths of its posts, in order) puts them atop the
  first page of the list (`.canopy-featured`, an accent rule beside each) and out of the dated
  pages — page counts follow — and after a post's own `readNext:` in what to read next. An entry
  that is no post of the stream fails `canopy build`; `featuredProblems` and `streamFeatured` are
  exported.
- `newestFirst`, the order of a stream's posts, and the `PageProblem` type are exported.

- A tag's page is read a page at a time, like the stream's own list: past the stream rule's
  `pageSize` posts it continues on `<folder>/tags/<slug>/page/2.html` …, each page ending with the
  same `.canopy-pagination` and titled "<tag> · Page n of N". `streamTagPaths` and `canopy list
  --json`'s `generated` name those pages; `tagPagePath` takes the page number, and `tagPageCount`
  says how many a tag takes.

### Changed

- `tagProblems` returns `PageProblem` objects (`{ sitePath, message }`, the message without the
  path) — a checker reports each by its page without parsing the text.
- The link to the list of a stream's tags (`.canopy-tag-index-link`) is on the first page of a
  tag's list only, as it is on the first page of the stream's list; later pages lead back through
  the pagination.

## [0.26.0] — 2026-10-07

Upgrading: a stream post's `tags:` now show and get pages under `<folder>/tags/`. A tag that can have
no page — no letters or digits, or one named "index" — fails the build; so does a vault file at a tag
page's path. Manual pages' `tags:` are unchanged.

### Added

- Tags in a stream: a post's `tags:` (a list, or one string) close the post and its item in the list
  (`.canopy-tags`), each leading to `<folder>/tags/<slug>.html`, which lists the posts carrying it;
  `<folder>/tags/index.html` lists every tag with its count (`.canopy-tag-index`,
  `.canopy-tag-count`), linked from the folder's index and each tag's page (`.canopy-tag-index-link`).
  Slugs keep letters of every script; spellings that share a slug are one
  tag, shown the way most of its posts spell it. `--strings` key `tags`. `canopy list --json` names
  the pages; `streamTagPaths`, `tagProblems`, `tagSlug` and the rest are exported for a checker.

## [0.25.0] — 2026-10-07

Upgrading: a stream folder with more than ten posts now lists the newest ten on its index and the
rest on `<folder>/page/2.html` on — set the rule's `pageSize` for another count. A vault page at one
of those paths is refused, like any file at a path canopy writes.

### Added

- A stream's list in pages: the layout rule's `pageSize` (default 10) posts on the folder's index,
  the next on `<folder>/page/2.html`, `page/3.html` …, each page ending with the way to the pages
  beside it (`.canopy-pagination`, new hook; `rel="prev"`/`"next"`). `--strings` keys `pageOf`,
  `newerPosts`, `olderPosts`. `canopy list --json` names the pages in `generated`; `streamPagePaths`
  and `streamListingPage` are exported.

## [0.24.0] — 2026-10-07

Upgrading: nothing to do. Stream pages gain an author, a cover and links to the neighbouring posts
where the frontmatter and the stream give them; manual pages are unchanged.

### Added

- A stream page's byline names its `author:` first (`.canopy-author`), and its `image:` is its
  cover (`.canopy-cover`) — under the byline, and atop its item on the folder's listing. A site path
  is addressed from the page; an absolute or root-absolute URL is used as written. Manual pages are
  unchanged. Two new theming hooks: `.canopy-author`, `.canopy-cover`.
- A stream post ends with the post published before it and the one after (`.canopy-page-nav`,
  `rel="prev"`/`"next"`), in the stream's newest-first order, each over its title with which one it
  is (`.canopy-page-nav-label`, new hook) — `--strings` keys `olderPost` and `newerPost`.

## [0.23.0] — 2026-10-07

Upgrading: nothing to do. A caller that runs `canopy list` before a build can pass the build's output
directory as `--out` to get the build's exact view.

### Fixed

- `canopy build <vault> <out>` with the output directory inside the vault (`canopy build . site`)
  no longer reads a previous build's output back in as vault files. Every build published the
  previous site one folder deeper (`site/site/…`), so the output depended on what ran before.
- `canopy build` refuses the vault itself as the output directory, which would write the site over
  its sources.

### Added

- `canopy list --out <dir>`: the listing leaves out the build's output directory as the build does.

## [0.22.1] — 2026-10-07

Upgrading: nothing to do. A folder link to a folder with an index page is now written as that page
(`guide/` → `guide/index.html`).

### Fixed

- A markdown folder link (`[x](guide/)`, `../`) to a folder with an index page reaches that page:
  it is written as the page's own location, in the page's spelling, and the page lists it among
  its backlinks. It was left as written — leading nowhere when written in another letter case than
  the folder — and was not counted as a reference.

## [0.22.0] — 2026-10-07

Upgrading: a caller of `resolveMarkdownLink` or `buildLinkIndex` passes or reads a page lookup in
place of a yes/no test — see *Changed*. A vault whose markdown links spell a page in another letter
case than its file now gets working links; nothing to do.

### Fixed

- A markdown link that reaches a page only by ignoring letter case (`[x](Guide/Install.md)` for
  `guide/install.md`) is written as the page is spelled (`guide/install.html`), as a wikilink to
  the same page already was. It kept the link's spelling, which leads nowhere on a host that tells
  letter case apart — and the page did not list the linking page among its backlinks.

### Changed

- `LinkIndex.has(sitePath): boolean` is now `LinkIndex.page(sitePath): string | undefined`, the page
  at that path in the build's own spelling. `resolveMarkdownLink`'s third argument is the same
  lookup, and the result is in that spelling. An `.html` target that names a page is matched the
  same way; one that does not is passed through as an asset, as before.

## [0.21.1] — 2026-10-07

Upgrading: nothing to do. `resolvePageLayout().streamDir` now spells the folder as the page's own
path does (see *Changed*); compare it ignoring case if you compare it to a layout key.

### Fixed

- A stream page's reading time counts every Han ideograph and kana by the character, as it
  already did for the common blocks: ideographs outside the Basic Multilingual Plane (CJK
  extension B and later), the iteration mark `々` and half-width katakana were counted as words.
- A stream folder named in a layout rule in another letter case than the folder itself (`"BLOG"`
  for `blog/`) gets its index page, and every link back to it, in the folder's own case. Both used
  the rule's spelling, which leads nowhere on a host that tells the two apart.
- The front page written for a whole-site stream (`--layout` with `default.profile: "stream"` and no
  root index) takes `--strings`' `indexTitle` when the layout gives it no `title`, as the contents
  page does. It was always "Contents".

### Changed

- `PageLayout.streamDir` (from `resolvePageLayout`) is spelled as in the page's own path, not as
  the layout rule that matched it ignoring case wrote it.

## [0.21.0] — 2026-10-07

Upgrading: a vault that publishes a file at a path canopy writes (see *Fixed*) now fails the
build instead of silently losing one of the two — rename or move the file the error names. Pages
gain a skip link and `<main id="canopy-main">`; tables gain a `.canopy-table` box; a page named by
its day (`2026-10-03-….md`) with no `date:` is now dated. Nothing is removed or renamed.

### Fixed

- **A vault file at a path canopy writes itself fails the build.** A vault publishing
  `tokens.css`, `styles.css`, KaTeX's files, a page's `.html`, a stream folder's generated index
  page, or a path a flag writes (`--stylesheet`, `--script`, `--search-index`, `--feed`) used to
  replace canopy's file or be replaced by it, silently — a vault `tokens.css` dropped canopy's
  design tokens. The build now names each such file and what canopy writes there. Before this,
  only `--stylesheet` and `--feed` paths were checked.
- A `--exclude` pattern naming a dot-file, a dot-folder or something under `node_modules` is no
  longer reported as matching nothing: those paths are never published, so the pattern is
  redundant, not a mistake.
- **A table wider than the screen scrolls within itself** instead of pushing the whole page
  sideways. Each table sits in a `.canopy-table` box that scrolls horizontally, with the same
  edge shadow a wide code block has; the table itself keeps its display and semantics.

### Added

- **A skip link on every page.** Each page opens with a link past its header and navigation to
  the content (`.canopy-skip-link`, hidden until a keyboard reaches it), and every `<main>` has
  `id="canopy-main"` — a stable target for a site's own link too. A header fragment can place
  it with the new `skip-link` slot; the page then does not open with a second one. Text:
  `--strings` key `skipToContent`.
- **`--color-scheme <light|dark>`** for a site with one colour scheme. Every page carries
  `data-theme` and `<meta name="color-scheme">` from the start, so the palette, code highlighting
  and a stylesheet's own dark block apply for every reader regardless of system preference, and
  no theme toggle is drawn (a `theme-toggle` slot shows nothing, with a build warning).
- **A file named by its day is dated.** `2026-10-03-launch.md` (or `2026-10-03.md`) gets that day
  wherever a page's date counts — the date under its title, `article:published_time`, the
  `Article` data, a stream's order and byline, a listing, a feed — when its frontmatter names no
  `date:`. `date:` wins when both are present. Exports `pageDate` (the rule) and `fileNameDate`.
- `fragmentControls(html)`: the control slots a fragment places, for a caller checking a site.
- Hook `.canopy-table`: the box each table in an article scrolls inside.
- `outputCollisions(published, plan)`: the published files that would land on a path canopy
  writes, with what it writes there — the build's own check, for a caller checking a site first.

## [0.20.0] — 2026-10-04

### Added

- **Profiles.** `--layout <path>` gives each folder a profile. `stream` is for dated pages:
  ordered newest first by `date:` everywhere the site lists them, one column without the
  sidebar tree, the page's `description:` as a lead under its title, a byline with the date and
  reading time, and the contents open before the body. A stream folder's index page lists its
  pages with date, reading time and summary; canopy writes that page when the folder has none.
  `manual`, the default, is the shell as before.
- **Regions and slots.** A layout fills `head`, `header`, `beforeArticle`, `afterArticle` and
  `footer` with HTML fragments from the vault. `header` and `footer` replace canopy's own with
  the site's markup; `<canopy-slot name="…">` places canopy's controls inside it (site title,
  home, back, breadcrumb, language, search, theme toggle) or a page's own frontmatter text
  (`page:<key>`). Links in a fragment are written from the site root and rewritten per page.
  Fragments are not published. An unknown slot, a control slot with content, or a page value
  that is not text fails the build, naming the file or page.
- **`canopy list --layout`** leaves fragments out and adds `generated`: the index pages a build
  will write.
- **Language links.** The `language` slot links the same page in each other edition named in
  `--alternate`, labelled in that language ("한국어").
- New hooks: `.canopy-site-title`, `.canopy-back`, `.canopy-language`, `.canopy-lead`,
  `.canopy-byline`, `.canopy-reading-time`, `.canopy-toc`, `.canopy-before-article`,
  `.canopy-after-article`; `data-canopy-profile` on `<html>`. Exports for callers checking a
  site before building it: `parseLayout`, `resolvePageLayout`, `layoutFragments`,
  `fragmentProblems`, `fragmentLinks`, `pageSlotKeys`, `pageSlotText`, `readingMinutes`,
  `callerStylesheetPath`.

### Changed

- The site title link carries `class="canopy-site-title"`, and the site title, home and back
  links are styled by their own classes rather than by sitting in `.canopy-topbar` — so a
  control placed in a site's own header looks the same as in canopy's top bar. On a page with
  no layout everything looks the same; the only differences in its HTML are `data-canopy-profile`
  on `<html>` and the class on the site title link.
- `THEME_HOOKS` is frozen and typed as its literal names (`ThemeHook`).

## [0.19.0] — 2026-10-03

### Changed

- **Canopy's CSS is in a cascade layer.** `tokens.css`, `styles.css` and the KaTeX stylesheet a
  build copies are wrapped in `@layer canopy`, so any stylesheet outside that layer wins over them
  regardless of specificity. A caller's global rule (`a { … }`) now takes precedence over canopy's
  own on an emitted site. The exported `CANOPY_TOKENS` and `BASE_CSS` are unchanged.
- **Breaking: `--tokens-css` is replaced by `--stylesheet`/`--site-stylesheet`, and `emitSite`'s
  `tokens` by `styles`/`siteStylesheets`.** `--stylesheet <path>` (repeatable) carries a file into
  `assets/stylesheet-<n>.css`, linked after canopy's own; a relative `url()` in it resolves from
  `assets/`. A vault file already at that path fails the build. Migration: pass a token file to
  `--stylesheet` (or its contents in `styles: [css]`); one whose `url()`s point at files beside it
  in the vault belongs under `--site-stylesheet` instead.

### Added

- **`--site-stylesheet <path>`** (`siteStylesheets` in `emitSite`) — link a stylesheet the vault
  publishes, at its own path, after every other stylesheet; repeatable. A relative `url()` inside
  it resolves as its author wrote it. A missing or excluded path fails the build.
- **`THEME_HOOKS`** and **[docs/THEMING.md](docs/THEMING.md)** — the class names a stylesheet or
  script may rely on, as a documented and tested contract; everything else the shell emits is
  stated to be internal.

### Fixed

- **A caller's dark-mode tokens apply.** A dark value written as the documented
  `@media (prefers-color-scheme: dark)` override used to lose to canopy's own dark palette, whose
  selector is more specific; outside canopy's layer it now wins. The documented override is also
  corrected to follow an explicit `data-theme` as canopy's own palette does — state dark values for
  `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` and for
  `:root[data-theme="dark"]` (see docs/THEMING.md).

## [0.18.0] — 2026-10-03

### Added

- **`listing: true`** in a page's frontmatter lists the pages it fronts after its own content
  (`.canopy-listing`): its children in the navigation tree (the rest of the top level for the
  site's front page), in sidebar order, each with its name, `date:` and own `description:`. A
  series' index page stays current without restating its entries by hand. Opt-in; pages without
  it are unchanged.

## [0.17.0] — 2026-10-03

### Added

- **Dated pages.** A page whose frontmatter names a `date:` shows it under its `h1`
  (a `<time>` in `.canopy-date`, spelled for `--lang`), states it as
  `article:published_time` — and `updated:` as `article:modified_time` — in `<head>`, and carries
  a schema.org `Article` block (`application/ld+json`) with headline, description, dates,
  language, an optional `author:`, and the image and URL when `--site-url` makes them absolute.
  Undated pages render exactly as before.
- **`--feed <dir>`** (`feeds` in `emitSite`) — an Atom feed of the dated pages beneath a folder, at
  `<dir>/feed.xml`, newest first, linked from that folder's pages for autodiscovery. Entries carry
  the page's name, `date:`/`updated:`, its own `description:` and `author:`; the feed is dated by
  its most recently changed entry. Needs `--site-url`; a folder with no dated page gets no feed
  (and a warning) rather than one with an invented update time. `renderFeed()` and `feedPath()`
  are exported.
- **`frontmatterDate()` and `formatPageDate()`** — the rule for which frontmatter values are dates,
  and how a date is spelled for a language, exported so other tools reading the same frontmatter
  agree with the renderer.

### Changed

- `build` reads the pages, copies the assets, and checks `--site-icon`/`--site-logo`/
  `--site-image` from one listing of the vault — the same `listVault` answer `list` prints — rather
  than walking the vault once per purpose.

## [0.16.0] — 2026-09-28

### Added

- **A `--nav` spec can leave part of the tree to canopy.** A group's `derive: "<dir>"` fills it
  with the pages beneath that directory the spec does not place elsewhere, derived the way the
  default navigation is (folders first, a folder's index page as its link), after any `items` it
  lists itself; `order: "asc" | "desc"` sorts that derived part by file name. A spec's
  `unplaced: "append"` places every page it did not mention after its own items instead of
  reporting them. Ordering one section of a site no longer means restating the rest of it — or
  canopy's derivation rules — by hand. Existing specs mean what they meant.
- **`buildNavigation(entries, { order })`** — the same file-name ordering for library callers.
- **The link-resolution rule is exported**: `isExternalUrl`, `parseLinkUrl`, `decodeLinkPath`,
  `resolveRelative`, `resolveMarkdownLink` — the pure functions the renderer itself uses to decide
  where a markdown link points. A tool that checks links without rendering can now give the
  renderer's answer instead of restating the rule and drifting from it (as happened when canopy
  began decoding `%20` one release before a checker did).

## [0.15.0] — 2026-09-28

### Added

- **`canopy list <vault-dir> [--exclude <pattern>]... [--json]`** — what `build` would publish,
  without building. The same walk the build uses, so a caller checking a site before publishing
  it no longer has to restate canopy's exclusion rules (hidden files and directories,
  `node_modules`, the `--exclude` dialect) and drift from them when they change. `--json` splits
  the answer into `pages` and `assets` the way the build does and adds `unusedExcludes`: the
  place-naming patterns that matched nothing, usually a path written from the wrong folder.

### Changed

- **`canopy list`, `--help` and `--version` start in a fraction of a second.** The CLI loaded
  the whole rendering pipeline (unified, Shiki, KaTeX) before looking at its arguments; it is
  now loaded only when a build runs.

### Fixed

- **The root index page comes first in a derived sidebar and in the prev/next reading order.** It
  was sorted among the root's leaf pages, after every folder, so a site's front page sat at the
  bottom of the sidebar and the reading order ended on it: the front page had a "previous" link
  and no "next", and the first real page had no "previous". It is now the first entry, the same
  position a folder's own index page takes relative to that folder. A `--nav` spec still decides
  its own order.
- **`canopy --help` and `canopy --version` succeed.** Both printed the usage text as an error and
  exited 1. `--help`/`-h` (anywhere on the line) now prints the usage to stdout and `--version`
  prints canopy's version, each exiting 0.
- **An unknown option is an error, not an output directory.** `canopy build vault --site-titel X`
  built the site into a directory named `--site-titel` and left the intended option unset; a
  third positional argument was silently ignored. Both now fail with a message naming the
  argument.

## [0.14.0] — 2026-09-27

### Changed

- **Dot-prefixed files are no longer published.** Only dot-prefixed *directories* were skipped, so a
  vault that is also a code checkout copied `.env`, `.gitignore` or `.DS_Store` into the site as
  assets. Hidden files are now skipped at every depth, like hidden directories — they are tooling
  state, and some of it is secret. A host directive that used to ride along from the vault (such as
  `.nojekyll`) now has to be added by the deploy step.
- **KaTeX 0.18, one copy.** Math was rendered by rehype-katex's own KaTeX while the site shipped
  the stylesheet of canopy's `katex` dependency — two versions that only happened to line up.
  canopy now depends on KaTeX `^0.18.7` and pins a single copy with an npm `overrides` entry, so
  in canopy's own build the markup and the stylesheet come from one version; a test fails if
  rehype-katex ever resolves a different copy. KaTeX 0.18 prefixes some of its internal CSS
  classes (`.base` is now `.katex-base`, `.hline` is `.katex-hline`), so a caller styling KaTeX's
  inner markup should check its selectors.

### Fixed

- **A site built from an installed canopy ships the stylesheet and fonts of the KaTeX that
  renders its math.** npm applies `overrides` from the root project only, so where canopy is a
  dependency rehype-katex can resolve its own nested KaTeX. The CLI now copies KaTeX's assets
  from the copy rehype-katex imports, not from canopy's own `katex` dependency.

## [0.13.0] — 2026-09-17

### Added

- **Search and link-preview metadata in every page's `<head>`.** A page's frontmatter
  `description:` now fills `<meta name="description">` (the site-wide `--site-description` stays
  the fallback), so a site no longer presents one identical summary on every page. The Open
  Graph basics — `og:title`, `og:description`, `og:type` (`website` for the front page,
  `article` elsewhere), `og:site_name` — and a `twitter:card` are written on every page; they
  need nothing absolute, so they appear on every site built with this version, with no flag to
  turn them off — a consumer diffing output against 0.12.0 will see them and should. The tags
  that do — `<link rel="canonical">`, `og:url`, `og:image`, and
  `<link rel="alternate" hreflang>` — appear only once `--site-url` names where the site is
  published, so a build without it is byte-for-byte as portable as before, and body links stay
  relative either way. `--site-image` (or a page's own frontmatter `image:`) supplies the
  preview image; `--alternate <lang>=<url>` (repeatable) declares the site's other language
  editions, each page listing its counterpart at the same path under every edition, its own
  first. `pageUrl()`/`fileUrl()` are exported so a caller writing a sitemap names each page by
  exactly the canonical string the shell writes.

### Changed

- **The sidebar's rows are now a designed unit, not bare text.** Every entry — a leaf's link or
  a group's whole summary — shares one padding, radius, and line-height; a hovered row gets a
  neutral surface (`--sidebar-hover-bg`, new, derived from `--text-normal`) instead of a color
  change plus underline; keyboard focus draws a ring inside the row; the current page's tint
  covers a group's chevron together with its label, not just the link beside it. The nav's type
  steps one size below the body (as the on-page outline already did) on the two-column layout
  and returns to the body's size in the full-screen mobile panel, whose rows also grow to
  thumb height.
- **A group's chevron now sits at the trailing edge of its row.** Leading, it was the one thing a
  group row had that a leaf row didn't, so labels at the same depth started at two different
  x positions. Every label at a depth now shares a left edge, and the chevron stays beside a
  wrapped label's first line rather than floating between its lines. A consumer that styled
  `.canopy-nav-group > summary::before` should target `::after` instead.
- **Nested sidebar lists carry a 1px guide line** under their parent's label, and top-level
  entries get a little air between them, so the tree's structure is legible without reading it.
- **`--sp-1` (4px)** joins the spacing scale, and the two largest content headings tighten
  their tracking slightly.

## [0.12.0] — 2026-08-22

### Added

- **An external-link icon on `home` when it points outside the site.** `home.url` sits right
  after the breadcrumb, which never leaves the site — so a reader had no reason to expect an
  outside link to look identical to it. Marked only for a genuine different-origin URL (an
  explicit scheme, or a protocol-relative `//host` one); a root-absolute `home.url` (this site's
  own domain root) is left unmarked, since it stays on the same site.
- **A scroll-edge shadow on code blocks wider than the viewport.** `overflow-x: auto` alone gave
  no sign that a cut-off right edge was scrollable rather than just where the code stopped, on
  any OS/browser that hides its scrollbar until hovered. A shadow now appears at whichever edge
  still has more to scroll to, and disappears once scrolled there — no script, tied to the
  block's own scroll position via CSS alone.

### Fixed

- **The on-page outline now shows its own label, not just a screen-reader-only `aria-label`.**
  `strings.onThisPage` was already configurable, but the only place it appeared was an
  `aria-label` on the outline's `<nav>` — the sidebar showed a bare list of headings with
  nothing naming it. `renderBacklinks`, the shell's other `strings`-labelled aside in the same
  column, already showed its label as a visible `<h2>`; the outline now matches it. The
  `aria-label` stays alongside the heading — a page carries more than one `<nav>` landmark, and
  that is what tells them apart in a screen reader's landmark list.

## [0.11.2] — 2026-08-18

### Fixed

- **`**` now closes correctly when a CJK character follows it with no space.** CommonMark's
  right-flanking rule for a closing `**` requires the character just after it to be whitespace
  or punctuation whenever the character just before it is punctuation — a rule written for
  scripts that separate words with spaces. Chinese, Japanese, and Korean prose has neither: a
  particle or a full-width punctuation mark sits flush against the marker, so emphasis around
  CJK text routinely failed to close and rendered as literal asterisks. Canopy's markdown
  pipeline now accounts for this via `remark-cjk-friendly`.

## [0.11.1] — 2026-08-17

### Fixed

- **The sidebar's current-page highlight now fills the row.** The tint previously wrapped only
  the label text, leaving the rest of the row bare — every other row-level target (a hover, a
  group's own summary) already spans the full width, so the current-page marker read as
  narrower and less confident than its neighbors.
- **The mobile topbar no longer stacks three separate rows of chrome before a reader reaches
  the page.** The breadcrumb — redundant with the sidebar's own expanded-to-current-page state
  once a reader opens it — is dropped below the topbar's own width; search collapses to its
  icon and expands while focus is anywhere inside the search form instead of reserving a full
  text box at all times (so tapping a result from a caller's search script doesn't collapse the
  box out from under the tap); and search and the theme toggle now share one wrapping unit, so
  a narrow topbar wraps them together rather than stranding the toggle alone on a row of its own.

## [0.11.0] — 2026-08-17

### Added

- **Sidebar groups collapse.** A nav entry with children now renders as its own
  `<details class="canopy-nav-group">` rather than a permanently-expanded nested list — closed
  by default, open exactly along the path to the page a reader is on, computed fresh per page
  with no script and nothing to remember across page loads. A long, deeply nested tree no longer
  shows every branch expanded at once regardless of where the reader actually is.
- **A breadcrumb trail.** The topbar can now show the ancestor path to the current page (`Guide
  / Orders / Payables`) — a projection of the same tree the sidebar already walks, not a second
  source of truth. Rides along only when the topbar already exists for another reason (a title,
  a logo, `home`, or search), the same rule the theme toggle already follows, and is omitted for
  a top-level page or one the tree doesn't place at all, where a one-entry trail would say
  nothing the page's own `<h1>` doesn't already say. `strings.breadcrumb` overrides its
  accessible label (default `"Breadcrumb"`).

### Changed

- **The sidebar's current-page background tint is stronger: 8%/12% (light/dark) → 16%/22%.** A
  callout background sits alongside an icon, a bold title, and a left border, so 8%/12% reads as
  supporting texture there; carrying the *entire* current-entry signal alone (color and weight
  were already shown insufficient by themselves — see the commit that added this tint) in a
  long, deeply nested nav tree needs more than a callout's supporting-texture value.

### Fixed

- **The search input now shows a placeholder and a magnifying-glass icon instead of an empty
  box.** It carried an `aria-label` but no `placeholder`, and no icon — sound for a screen reader,
  but a sighted reader had nothing telling them what the box was for until they clicked it.
- **The topbar's site-title and home links no longer render in the browser's default blue with
  a permanent underline.** Every other link the shell draws (sidebar, content, outline,
  backlinks, page-nav) sets its own rest/hover colors; the topbar was the one place nothing did,
  so a site with a title, a logo, or a `home` link carried unstyled browser-default links across
  its top edge.
- **The on-this-page outline now follows the article instead of preceding it.** Below the
  width where the outline moves beside the text, it rendered before `.canopy-content` in
  document order — a reader on a narrow viewport, or anyone using assistive technology at any
  width, reached a list of the page's own headings before the page itself. The outline now
  follows the article in markup order, matching the order a reader without room for the
  side-by-side layout actually encounters the two; the side-by-side layout itself is
  unaffected, since it places both by an explicit grid rather than by document order.

## [0.10.0] — 2026-08-11

### Added

- **A heading may declare its own id.** `## Some Title {#stable-id}` sets the heading's id to
  `stable-id` instead of whatever github-slugger would derive from its current wording — for a
  heading expected to be reworded later whose fragment (used by `[[note#heading]]`, or linked
  from outside the vault) should not move with it. Canopy already assigned every heading an id;
  there was previously no way to pin one, so a heading with no stable id and a reader relying on
  its fragment anyway had encoded that reliance nowhere the renderer could see it — the wording
  changed, the id changed with it, and the link broke silently. A heading with no `{#id}` is
  unaffected.
- **A page's own prose now reads the shell's typography, not the browser's defaults.** Headings,
  blockquotes, and lists inside a page's content had no rules of their own — every other part of
  the shell (sidebar, outline, topbar) already read from the spacing/type tokens, but the article
  itself did not. Headings get a size scale and consistent vertical rhythm, a plain `>` quote
  (not a `[!type]` callout) gets a quiet left border and muted text distinct from a callout's own
  tint, and list items space apart without a phantom gap before the first one — all read from the
  same `--sp-*`/`--font-weight-semibold` tokens the rest of the shell already uses.
- **The sidebar's current-page entry now has a tinted background, not just color and weight.**
  A reader scanning a long, deeply nested nav tree could still lose track of which entry marked
  the page they were already on. The active entry is now a background pill, colored from
  `--sidebar-active-bg` (a new token, `--accent`'s own color at the same opacity convention the
  callout backgrounds already use) — sized to the label itself rather than the full row, so it
  needs no coordination with a nested list's own indentation at any depth.

### Fixed

- **The search index's body text ran block elements together with no space.** `htmlToText`
  (shared by the search index and heading-text extraction) stripped every tag identically, so
  a table's `<td>a</td><td>b</td>` read as `ab` and a list's `<li>` items ran into each other
  the same way — any page with a table or a multi-item list produced an unreadable search
  snippet. Block-level tag boundaries (`<p> <li> <tr> <td> <th> <br>` and similar) now become
  a space before markup is stripped; inline tags (`<code> <strong> <a>`) are left as before,
  since text adjacent in the source should stay adjacent.
- **The theme toggle's icon never changed.** The button showed the same sun icon whether the
  page was light or dark, giving no signal of which theme was current or which way a click
  would go. It now swaps to a moon once dark is actually in effect — via the system preference
  or an explicit `data-theme="dark"` override, the same two-path split the palette itself
  already uses.
- **A code block stayed on the light Shiki palette under an explicit dark override.** The
  dual-theme rule only read `prefers-color-scheme: dark`, so a reader whose system prefers
  light but who clicks the toggle into dark saw every other pixel go dark (`data-theme` drives
  the rest of the palette) while a fenced code block did not — the rule never looked at
  `data-theme` at all. It now resolves through the same two paths the palette itself already
  does: the media query, and an explicit override that wins regardless of it.
- **`htmlToText` left numeric character references undecoded.** It only knew five named
  entities; a `<`/`>` inside inline code comes back from rehype-stringify as a numeric
  reference (`&#x3C;`), which passed through untouched into search snippets and extracted
  heading text. Every decimal and hex numeric reference is now decoded generally, rather than
  adding named entities one at a time as each is noticed.

## [0.9.0] — 2026-08-11

### Added

- **`--strings` gains `indexTitle` and `backlinks`.** The synthetic contents page `emitSite`
  writes at the site root (when a vault has no root index page of its own) had its `<title>`
  and `<h1>` hardcoded to "Contents", and the backlinks section heading was hardcoded to
  "Linked references" — both were reader chrome text that fell outside `--strings`' coverage
  by oversight, the same category of text its other five keys already override. Unset, both
  keep their English default.

## [0.8.0] — 2026-08-09

### Added

- **`--strings <json>`** (and the library option `ShellOptions.strings`) overrides the reader
  chrome's own built-in text: search, the theme toggle, and the site/page/outline navigation
  landmarks. `--lang` only ever changed what `<html lang>` declares; this text is canopy's own
  UI, not vault content, so it stayed English regardless. No built-in translation table — the
  same reasoning `--home-label` already follows, since link text has to be written in the
  site's own language. Keys left unset keep their English default.

### Changed

- **`--home-url` resolves a relative value against each page's depth**, the same way every other
  internal link canopy writes already does. A scheme, protocol-relative, root-absolute, or
  fragment value is still used exactly as given. Previously a relative value was emitted
  verbatim, which only rendered correctly for pages at the site root.

## [0.7.0] — 2026-08-09

### Added

- **A caller can now extend the rehype stage with its own plugins**, both as a
  library option (`SourceTree.rehypePlugins`) and as a CLI flag
  (`--rehype-plugin <specifier>`, repeatable — accepts a bare package name or
  a filesystem path, loaded and run in canopy's own process). Plugins run at
  a single fixed position: after sanitize (so a plugin's output is trusted
  the same way katex's and Shiki's already are, and is never stripped) and
  before Shiki (so a plugin can claim a fenced code block by its language
  before Shiki renders it as plain highlighted code). Verified against the
  published `rehype-declart` package end to end.

## [0.6.0] — 2026-08-09

### Added

- **The sidebar now marks the page a reader is already on** with `aria-current="page"` on its
  link, styled in the accent color by default. A caller who wants different styling can target
  `[aria-current="page"]` directly — no new class name.
- **A caller can now force light or dark regardless of system preference**, with
  `data-theme="dark"` or `data-theme="light"` on `<html>` — the `prefers-color-scheme` default
  is unchanged when neither is set. A hidden `.canopy-theme-toggle` button rides in the top bar
  whenever one exists (for the same reason as `.canopy-search`: no script means it never shows),
  ready for a caller-supplied script to reveal and wire up.
- **Every page now carries prev/next cards** (`.canopy-page-nav`) linking to its neighbors in
  the sidebar's own reading order — the order a reader already sees, not a re-derived one.
  Omitted at either end of that order, and for a single-page site.

### Changed

- **The mobile navigation panel is now a full-screen overlay while open**, replacing the
  in-flow block that used to push page content down (capped at a fraction of the viewport
  height). Its control is now a menu/close icon rather than the native disclosure marker.
  Closed, it is a single compact line again — a `min-height: 100vh` left over from the desktop
  layout was stretching that line into a tall, mostly-empty band on narrow screens, which is
  fixed here too.
- **An unlabelled code fence and a fence naming an unresolvable language now render the same
  way**: themed plain-text code blocks — same background and font as every other fence, no
  syntax coloring — rather than an unstyled block that read as a different kind of element.

## [0.5.0] — 2026-08-09

### Added

- **A hidden search form in the top bar** when `--search-index` is given: `<form class="canopy-search" role="search" hidden>` with a single `<input type="search">`. `.canopy-search` is a documented mount point, not an internal implementation detail — a caller's script can rely on it directly instead of reaching into the shell's sidebar structure. Canopy still writes no script itself; the form starts hidden and stays that way until a caller-supplied script finds it and reveals it. No new flag: a search index and a place to search from are one feature.
- **`--script <path>`**: carries a caller-supplied script file into `assets/script.js` and links it `<script defer>` from every page, relative to that page's depth. Canopy neither reads nor executes the file — it only carries it, the same way `--tokens-css` carries CSS. Absent the flag, output is unchanged. This is what lets a caller supply the behavior behind `.canopy-search` (or a theme toggle, or anything else) without canopy authoring any of it — see the widened non-goal in `docs/SCOPE.md`, "Author client-side code".

## [0.4.0] — 2026-08-08

### Added

- **`--search-index <path>`**: writes a JSON array of `{ p, t, h, b }` (site path, title,
  heading text, plain-text body) — one entry per page — to the given output-relative path.
  Opt-in and untruncated: canopy already holds all four while rendering, so a consumer
  building a client-side search UI does not have to reparse markdown to get them, and no
  size-driven truncation is applied since real sites stay in the low hundreds of KB gzipped
  even with full page bodies (measured against a 255-page corpus). The shell markup a search
  UI would mount into, and a way to carry that UI's script into the published site, are not
  part of this flag — those are still open design questions, tracked separately.

### Fixed

- **Every page now fits the viewport on a narrow screen instead of scrolling horizontally.**
  `.canopy-main` is a grid item of `.canopy-layout` at every width, and grid items default to
  `min-width: auto` — which used `.canopy-main`'s own `max-width` (768px) as a floor on the
  grid track's size, keeping the single mobile column (and the whole page with it) 768px wide
  regardless of viewport or content. `min-width: 0` is the standard way to opt a grid item out
  of that default.
- **The on-page outline now stays pinned to the viewport on scroll, matching the sidebar.**
  It previously used `position: absolute`, computed once against `.canopy-main`'s box and then
  unaffected by scrolling — while `.canopy-sidebar` has stayed pinned via `position: sticky`
  since 0.3.0. `.canopy-main` and its children (`.canopy-content`, `.canopy-outline`,
  `.canopy-backlinks`) now use an explicit two-column grid instead: `position: sticky`'s inset
  properties offset from a box's own in-flow position rather than a containing block's edge, so
  keeping the outline "beside" the article once it also needs to stay in flow required a real
  column, not an offset. Scoped to pages that have an outline at all (`:has(.canopy-outline)`),
  so a page without one keeps its previous centered, single-column width.

## [0.3.1] — 2026-08-08

### Fixed

- **The sidebar/main two-column layout, and the tint that divides them, are back.** A doc
  comment landed in 0.3.0 (`f4ceebd`) wrote a custom-property prefix pair as
  `--sp-*/--bg-*` — the `*/` closed the CSS comment early, and everything from there to the
  comment's real closing `*/` became part of the *next* rule's selector prelude. An invalid
  prelude drops the whole rule, so `.canopy-layout` (`display: grid` and the sidebar/main
  divider) parsed to nothing in a real browser: the sidebar and main stacked as full-width
  blocks with no visual boundary between them. Every existing test matched against the raw
  JS string, which this bug never touched, so 0.3.0 shipped and published with it. A new test
  (`comment safety`) checks what a real CSS parser sees instead.

## [0.3.0] — 2026-08-08

### Fixed

- **The sidebar no longer scrolls away with the page.** On a grid layout, an item without an
  explicit height stretches to match its tallest sibling — so the sidebar grew exactly as tall
  as the main content, and its own `overflow-y: auto` never had anything to scroll: the whole
  page moved as one unit and the navigation disappeared off-screen on any page longer than the
  viewport. The sidebar now keeps its own box, capped at the viewport height, and stays pinned
  to the top of the viewport while the content scrolls past it. Unaffected below the mobile
  breakpoint, where the sidebar stacks above the content instead of beside it.

### Changed

- **Sidebar navigation items now carry their tree depth as a class** (`canopy-nav-l0`,
  `canopy-nav-l1`, …), the same pattern the on-page outline already used. The top level gets a
  small default weight distinction; deeper levels are unstyled by default so a caller can target
  any level directly instead of re-deriving depth from `<ul>` nesting.
- **The mobile navigation's height cap dropped from `40vh` to `25vh`.** The disclosure still
  ships open on every page load (canopy writes no client-side code to remember a reader's choice
  across pages — see the no-JS non-goal in `docs/SCOPE.md`), so this cap is what a reader sees
  above the fold on every single page, not just the first. The lower cap leaves noticeably more
  of a phone screen for content on first paint; the reader's own control to collapse it further
  is still there underneath.
- **The site title, logo, and home link moved out of the sidebar into a full-width top bar.**
  They previously lived in `.canopy-site-title`, a block confined to the sidebar's own column;
  that class is gone, replaced by `<header class="canopy-topbar">` as a sibling of the sidebar/main
  layout rather than a child of the sidebar. A caller with custom CSS targeting
  `.canopy-site-title` needs to retarget it to `.canopy-topbar`. Unchanged: which settings turn
  the bar on (`--site-title`, `--site-logo`, `--home-url`/`--home-label` — absent all three, no
  bar renders, same as before), and the markup and behavior of everything below it.

  The sidebar's own tinted background and its divider move too, from `.canopy-sidebar`'s
  `background`/`border-right` to a single `background: linear-gradient(...)` on `.canopy-layout`
  (a caller targeting either property directly needs to retarget to `.canopy-layout`, and a caller
  that overrode only one of the two — the tint but not the divider, say — now needs to restate
  both, since they're one declaration). The sidebar box itself sizes to its nav list's own content
  rather than a fixed viewport height, so painting the tint there would have stopped wherever a
  short list ends, short of the actual column; a gradient on the layout container behind it
  reaches the bottom of the column regardless of how long the list is.

## [0.2.0] — 2026-08-07

### Added

- **`--site-logo <path>`** shows a logo beside the site title in the sidebar header. It is
  vault-relative and validated like `--site-icon` — the build fails if the path is missing or
  excluded, rather than shipping a broken image. It is decorative, carrying an empty `alt`,
  since the site title next to it already names the site.
- **`--home-url <url>` / `--home-label <text>`** add a link back to the site this documentation
  is published beside. Both or neither: link text has to be written in the site's own language,
  so there is no default worth guessing. A site setting neither renders exactly as before.
- `docs/SCOPE.md` now states outright that canopy writes no client-side code: nothing a script
  could do — a theme toggle, a search box, an analytics beacon, a comment widget — is something
  canopy implements. This had only ever lived in a code comment; it is now a stated non-goal so
  the boundary can be pointed at rather than re-argued.

### Changed

- **Caller tokens are now layered over canopy's defaults instead of replacing them.**
  `--tokens-css` (and `emitSite`'s `tokens` option) used to write `tokens.css` outright, so
  overriding one custom property discarded the roughly sixty others the shell reads. The
  caller's stylesheet is now appended after canopy's own, so a one-line override keeps every
  other default and a caller supplying the full vocabulary is unaffected. Because the defaults
  end in a `prefers-color-scheme: dark` block, a bare `:root` override now applies to both
  schemes unless it is scoped to its own media query — see Theming in the README.

  **This is a behaviour change for anyone injecting a partial token stylesheet**: values it
  never mentioned, which previously fell back to nothing, now render with canopy's defaults.
  A stylesheet that already restates the entire vocabulary is unaffected.

### Fixed

- A narrow screen no longer opens with the entire navigation stacked above the page content.
  The sidebar's navigation is now a `<details>` disclosure that ships open — the wide layout is
  unchanged — with a height cap and a native collapse control below a 40rem viewport width. A
  closed disclosure keeps a visible control at every width, so collapsing it on a narrow screen
  and then widening the viewport — rotating a phone to landscape, for instance — never strands a
  reader with the navigation hidden and no way to reopen it. No JavaScript is involved.
- `--tokens-css` now names the path and exits non-zero when the file cannot be read, instead of
  a raw stack trace, matching `--nav` and `--site-logo`/`--site-icon`.

## [0.1.2] — 2026-08-07

### Changed

- **A page is now named by its opening `h1` when it has no frontmatter title**, ahead of its
  filename. The order is `frontmatter title → first h1 → filename`, and the result reaches every
  place a page is named at once: the sidebar entry, the `<title>`, and the text of each backlink
  pointing at it. Canopy already parsed that heading — it was assigning it an id so links could
  target it — and then named the page after its file anyway, which calls the page something its
  own author never wrote. The effect is largest where filenames are ASCII identifiers and the
  documents are not: a whole sidebar in one language and a whole site in another. A folder's
  `index` page now names the folder it opens for the same reason, since the folder node and that
  page are one entry in the sidebar.

  **This changes visible labels.** Any page carrying an `h1` but no frontmatter `title` will be
  called something different than in 0.1.1, and navigation sorts by the new name. Pages that set
  a frontmatter title, and pages with no heading at all, are unchanged. To keep a previous label,
  set it explicitly — with frontmatter `title`, or with `label` in a `--nav` spec.

### Fixed

- A supplied `--nav` spec now names an unlabeled entry exactly as the derived tree would.
  Previously it fell straight through to the filename, so a folder's front page was labeled
  "index" in a spec-driven site while the same page was labeled by its folder in a derived one —
  and 0.1.1's index-page titling reached only the second. A spec supplies an order, not a
  different vocabulary. A `label` in the spec still wins over everything.
- Percent-encoded link targets resolve. `[x](a%20b/note.md)` addresses the same document as
  `[x](<a b/note.md>)` and is rewritten the same way; previously only the second was, so the
  first shipped as a `.md` URL that 404s. Canopy writes this encoding itself — every href it
  generates is percent-encoded per segment — so a page could hold canopy's own encoded link to a
  document in the sidebar and the author's identical link in the body with only one resolving.
  Editors produce the encoded form without the author typing it, which makes any vault with a
  space in a directory name subject to this. Decoding is per segment, so `%2F` stays a character
  inside a name rather than becoming a path separator, and a malformed escape leaves the link
  exactly as written.

## [0.1.1] — 2026-08-07

### Fixed

- Code blocks no longer render differently the first time a language appears. The syntax
  highlighter tokenizes differently on its first use of a newly loaded grammar, so the first
  code block of a site — every site, since a build is a fresh process — came out styled unlike
  every other one, and two identical blocks in one document could differ. Each grammar is now
  settled as it loads, which costs work the first render would have done anyway. This restores
  the guarantee the build rests on: the same input always yields the same output.
- An index page is titled for what it opens rather than for its filename: the site's front, or
  the folder it is the front of. `<title>` is the string that leaves a site — the browser tab,
  the bookmark, the search result, the link preview — and a page the sidebar called "Home" was
  called "index" there. A frontmatter title still wins, so pages that set one are unchanged.

- Syntax-highlighting grammars load on demand instead of as one bundle before the first render.
  Loading every language canopy ships cost seconds on the first rendered document — measured at
  3.6s warm and around 7.7s cold — and every caller paid it on every build, however few languages
  their notes used. Warm-up is now around 0.2-0.4s and each grammar arrives in single-digit
  milliseconds when a document first names it. Highlighting is unchanged: a language outside the
  set loaded so far is fetched on demand and highlighted normally.
- The unknown-language contract is now explicit and tested rather than incidental: a fence naming
  a language that cannot be resolved renders as a plain code block, exactly as an unlabelled fence
  does. Any other highlighter failure is a configuration defect and still fails the build.
- Test files run in parallel again. Serial execution was a mitigation for the warm-up above, and
  removing the cost removed its reason: the suite runs in about 5s rather than 100s, with the
  default per-test timeout restored.

## [0.1.0] — 2026-08-06

First published release. Development before it is recorded here in one block rather than
reconstructed as versions that never shipped.

### Added

- Markdown rendering: CommonMark + GFM, KaTeX math over a currency-safe subset, Shiki
  syntax highlighting with a light/dark dual theme, and `> [!type]` callouts
- Wikilinks (`[[note]]`, `[[note|alias]]`, `[[note#heading]]`) resolved tree-wide to
  relative hrefs, with a backlink graph
- Navigation tree derived from document paths alone, or supplied by a caller via `--nav`
  (library: `SourceTree.nav`). Array order is display order and is never re-sorted, and labels
  override the directory names that URLs use — a release log can read newest-first, a guide in
  teaching order. Pages a spec omits are reported, not silently dropped; a malformed spec fails
  the build naming the position
- Site shell: complete HTML documents with a sidebar, content, and backlinks — all internal
  links relative, so a site works from any sub-path
- Per-page outline: each page's `h2`/`h3` headings, carried on `RenderedPage.outline` and
  rendered as an on-this-page contents list. Plain anchors to ids the body already has, so it
  needs no script; pages with fewer than two headings get none
- Design-token vocabulary (`tokens.css`), overridable by a caller via `emitSite`'s `tokens`
  option or the CLI's `--tokens-css`
- `canopy build <vault-dir> [out-dir]` CLI with `--site-title`, `--site-description`,
  `--lang`, `--site-icon`, `--nav`, `--tokens-css`, and `--exclude`
- Document metadata: `--lang` sets `<html lang>` (a wrong or missing declaration is a WCAG
  3.1.1 failure, not a cosmetic one), `--site-icon` links a favicon relatively so it resolves
  from a sub-path, and `--site-description` fills `<meta name="description">`. An icon path
  that is missing or excluded fails the build instead of shipping a broken link
- `--exclude <pattern>` (repeatable) keeps drafts, archives, and generated scratch out of a
  published site while leaving them visible in the vault — a dot-prefix would hide them from
  the file explorer too, which is a different intention. Applies to markdown and assets
  alike, and prunes at the directory so an excluded tree is never walked
- Synthetic contents page when a tree has no root index
- `docs/SCOPE.md` — canopy's role, its non-goals, and the test for whether a proposed
  feature belongs here

### Fixed

- Markdown links pointing inside the vault are rewritten to the published page, matching
  what wikilinks already did. Previously `[text](note.md)` shipped the source path and
  404'd while `[[note]]` to the same target worked, and only the wikilink appeared in the
  backlink graph. Reference-style links (`[text][id]`) are covered too. Links that are not
  confidently inside the vault — absolute URLs, root-absolute paths, bare fragments, paths
  escaping the root, and targets that were never published — are left exactly as written.
- Test suite no longer fails intermittently. Each test file gets its own worker and so pays
  Shiki's ~11s highlighter warm-up separately; run in parallel those warm-ups contended for
  cores until 5-7 files crossed the timeout, with the failing set varying between runs.
  Test files now run serially.

### Notes

- Raw HTML in markdown is sanitized: safe authoring tags survive, injection vectors are
  stripped
- Dot-prefixed directories and `node_modules` are excluded from a vault walk. The rule is
  categorical rather than a list of known tool names, and now has tests pinning that
