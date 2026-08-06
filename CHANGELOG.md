# Changelog

Notable changes to canopy. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Canopy is a shared core with more than one consumer, so this file is part of its contract:
what changed in the rendering, the CLI surface, or the theming vocabulary is what callers
plan their upgrades around. Entries describe changes in canopy's own terms — never in terms
of a particular consuming project (see [docs/SCOPE.md](docs/SCOPE.md)).

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
