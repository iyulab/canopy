# Changelog

Notable changes to canopy. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Canopy is a shared core with more than one consumer, so this file is part of its contract:
what changed in the rendering, the CLI surface, or the theming vocabulary is what callers
plan their upgrades around. Entries describe changes in canopy's own terms — never in terms
of a particular consuming project (see [docs/SCOPE.md](docs/SCOPE.md)).

## [Unreleased]

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
