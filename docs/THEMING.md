# Theming

A site canopy emits looks finished with no styling of its own, and every part of it can be
restyled. This document is the contract for doing that: where canopy's CSS sits in the cascade,
which names a stylesheet can rely on, and which it cannot.

## Your CSS always wins

Everything canopy writes — `tokens.css`, `styles.css`, and the KaTeX stylesheet when a page has
math — is wrapped in one [cascade layer](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer),
`canopy`. A rule outside any layer beats every layered rule regardless of specificity, so a
stylesheet you supply wins over canopy's without a specificity contest:

A stylesheet reaches the page one of two ways:

```sh
# A stylesheet the vault publishes, linked where it stands:
canopy build notes site --site-stylesheet theme/brand.css
# A stylesheet from outside the vault, carried into assets/:
canopy build notes site --stylesheet ../shared/search.css
```

```ts
emitSite(bundle, { siteStylesheets: ["theme/brand.css"], styles: [searchCss] });
```

**`--site-stylesheet`** names a file the vault already publishes (it must not be excluded) and
links it at its own path, so a relative `url()` inside it — a font, a background image —
resolves exactly as its author wrote it. **`--stylesheet`** reads a file from anywhere and writes
it to `assets/stylesheet-<n>.css`; a relative `url()` in it then resolves from `assets/`, so carry
only self-contained CSS this way. Both repeat; carried stylesheets are linked after canopy's own,
and the vault's own after those, each in the order given.

A stylesheet that declares a layer of its own sits between canopy's and unlayered CSS: layers
order by first appearance, and canopy's always appears first.

The one exception is code blocks in dark mode. Their colours come from Shiki as inline styles,
which canopy overrides with `!important` — and a layered `!important` outranks an unlayered one.
Choose a code palette through the highlighting theme, not through CSS.

## Tokens

The shell reads its colours, type and spacing from custom properties. Restating one keeps every
other default:

```css
:root {
  --accent: #0a7c5a;
  --accent-hover: #096a4d;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --accent: #4ecfa2;
    --accent-hover: #6fdcb5;
  }
}

:root[data-theme="dark"] {
  --accent: #4ecfa2;
  --accent-hover: #6fdcb5;
}
```

Dark values are stated twice, the way canopy states its own: once for a reader whose system
prefers dark (unless the page was switched to light), once for a page switched to dark. A bare
`:root` outside canopy's layer applies in **both** schemes, so a dark value needs its own block —
and a plain `:root` inside the media query would also override a reader's choice of light. A
custom property canopy never reads is silently ignored, which is the usual reason an override
"does nothing".

| Property | What it colors |
|---|---|
| `--bg-primary` / `--bg-secondary` | Page background / sidebar and secondary surfaces |
| `--text-normal` / `--text-muted` / `--text-faint` | Body text / secondary text / the faintest tier |
| `--accent` / `--accent-hover` | Links, the current sidebar entry, focus and hover |
| `--border` / `--border-strong` | Hairline dividers / a more visible border |
| `--sidebar-active-bg` / `--sidebar-hover-bg` | Current and hovered sidebar rows (derived from `--accent` / `--text-normal`) |
| `--callout-{note,tip,warning,danger,quote}` / `-bg` | Each callout's accent and tinted background |
| `--font-ui` / `--font-monospace` | Body and UI typeface / code typeface |
| `--content-max-width` | The article column's maximum width |
| `--sp-1` … `--sp-8` / `--radius-m` | Spacing scale / corner radius |

Dark mode is the attribute `data-theme="dark"` on `<html>` (or the system preference when it is
absent), never a class.

A site with only one colour scheme says so with `--color-scheme dark` (or `light`): every page
carries that `data-theme` from the start, so canopy's palette, code highlighting and the dark
blocks of your own overrides apply for every reader whatever their system prefers, and there is
no theme toggle — a `theme-toggle` slot shows nothing. Your dark values still go in the
`[data-theme="dark"]` block above; nothing else needs restating.

## Hooks

These class names are stable: renaming or removing one is a breaking change, announced in the
changelog. Select on them freely.

| Region | Hooks |
|---|---|
| Top bar and controls | `.canopy-topbar` `.canopy-topbar-controls` `.canopy-site-title` `.canopy-logo` `.canopy-home` `.canopy-home-external` `.canopy-back` `.canopy-breadcrumb` `.canopy-language` `.canopy-search` `.canopy-theme-toggle` `.canopy-skip-link` |
| Layout and navigation | `.canopy-layout` `.canopy-sidebar` `.canopy-nav` `.canopy-nav-group` `.canopy-main` |
| Article | `.canopy-content` `.canopy-contents` `.canopy-before-article` `.canopy-after-article` `.canopy-lead` `.canopy-byline` `.canopy-author` `.canopy-date` `.canopy-reading-time` `.canopy-cover` `.canopy-toc` `.canopy-listing` `.canopy-listing-title` `.canopy-pagination` `.canopy-tags` `.canopy-tag-index` `.canopy-tag-count` `.canopy-tag-index-link` `.canopy-table` |
| Callouts | `.callout` `.callout-note` `.callout-tip` `.callout-warning` `.callout-danger` `.callout-quote` `.callout-title` |
| Around the article | `.canopy-outline` `.canopy-backlinks` `.canopy-page-nav` `.canopy-page-nav-label` `.canopy-prev` `.canopy-next` |

State is read from standard attributes, not classes: `aria-current="page"` on the current page's
link, `[open]` on a disclosure, `[hidden]` on a control no script has revealed.
`<html data-canopy-profile="manual">` or `"stream"` says which profile drew the page.
Every page's `<main>` carries `id="canopy-main"` — a stable target for a link of a site's own.

Every page opens with a skip link (`.canopy-skip-link`) to `#canopy-main`, hidden until a keyboard
reaches it. A header fragment that places the `skip-link` slot gets it there instead, inside the
site's own markup, and the page does not open with a second one. Its text is the `skipToContent`
string.

```css
/* A wider article and no sidebar — plain selectors, no specificity to match.
   The layout paints the sidebar column's tint as its own background, so it
   goes with the column. */
:root { --content-max-width: 60rem; }
.canopy-sidebar { display: none; }
.canopy-layout { grid-template-columns: 1fr; background: none; }
```

## Profiles

A layout (`--layout`) gives each folder a profile. `manual` is the shell above: a sidebar tree,
the outline beside the text, backlinks, and prev/next in tree order. `stream` is for dated
pages read one at a time, newest first:

- no sidebar tree, and no outline column — the page is one centered column;
- after the title, the page's `description:` as a lead (`.canopy-lead`), then a byline
  (`.canopy-byline`) with the page's `author:` (`.canopy-author`), the date (`.canopy-date`) and
  the reading time (`.canopy-reading-time`), then the page's `image:` as its cover
  (`.canopy-cover`), then the contents, open, in a disclosure (`.canopy-toc`, holding the same
  `.canopy-outline` list);
- the folder's index page lists the folder's posts newest first (`.canopy-listing`) — the pages its
  rule covers; a folder inside it under a rule of its own is not one of them — with cover,
  date, reading time and summary — canopy writes that index page when the folder has none. Ten
  posts to a page (the rule's `pageSize`): the rest continue on `page/2.html`, `page/3.html` …
  in the folder, each page ending with the way to the pages beside it (`.canopy-pagination`). The
  rule's `featured` posts stand atop the first page, in the order given (`.canopy-featured` on
  their items), and out of the dated pages;
- a post's `tags:` (a list, or one string) close the post and its item in the list
  (`.canopy-tags`), each leading to the tag's page, `<folder>/tags/<slug>.html`, which lists the
  posts carrying it — `pageSize` to a page like the folder's list, the rest on
  `<folder>/tags/<slug>/page/2.html` … with the same `.canopy-pagination`; `<folder>/tags/index.html`
  lists every tag of the folder (`.canopy-tag-index`) with how many posts carry it
  (`.canopy-tag-count`), and the first page of the folder's list and of each tag's link to it
  (`.canopy-tag-index-link`). A slug is the tag
  lowercased, with spaces and `/ ? # % \` as `-`; tags with one slug are one tag, shown the way
  most of its posts spell it;
- after a post's tags, what to read next (`.canopy-read-next`): the posts its `readNext:` names,
  then the posts sharing its rarer tags or linked with it, then the folder's newest — three in
  all, unless more are named. A manual page has the same list only when its `readNext:` names
  something;
- canopy's own top bar shows a link back to that index (`.canopy-back`) where a manual page
  shows its breadcrumb;
- after the article, the post published before it (`.canopy-prev`) and the one after
  (`.canopy-next`), each over its title with which one it is (`.canopy-page-nav-label`) — the
  same `.canopy-page-nav` a manual page ends with, in the stream's newest-first order.

Some hooks appear only where the page has that part: `.canopy-sidebar` on manual pages,
`.canopy-toc` on stream pages, `.canopy-topbar` only where canopy draws its own top bar.

## Regions and slots

A layout can also fill five regions with fragments — HTML files from the site itself:

| Region | Where |
|---|---|
| `header` | **Replaces** canopy's top bar with the fragment's markup, as written |
| `footer` | At the end of the page, as written |
| `head` | Added just before `</head>` — a stylesheet, fonts, structured data |
| `beforeArticle` | At the start of the article, in `.canopy-before-article` |
| `afterArticle` | At the end of the article, in `.canopy-after-article` |

Links in a fragment are written from the site root (`blog/`, `assets/logo.svg`) and rewritten
for each page: `href`, `src`, `poster`, `action`, and every URL in a `srcset`. A scheme,
`//host`, `#id` or `/path` is left as written.

A fragment places canopy's controls with slots, replaced when the site is built — nothing of
the slot reaches the browser:

```html
<header class="site-header">
  <a href="https://example.com/">Example</a>
  <canopy-slot name="back"></canopy-slot>
  <canopy-slot name="search"></canopy-slot>
  <canopy-slot name="theme-toggle"></canopy-slot>
</header>
```

| Slot | Becomes |
|---|---|
| `site-title` | The logo and site title link (`.canopy-site-title`) |
| `home` | The home link (`.canopy-home`) |
| `back` | On a stream page, the link back to its index (`.canopy-back`) |
| `breadcrumb` | The trail through the tree (`.canopy-breadcrumb`) |
| `language` | This page in the site's other language editions (`.canopy-language`) |
| `search` | The search form (`.canopy-search`) |
| `theme-toggle` | The theme toggle (`.canopy-theme-toggle`) |
| `skip-link` | The link past the header and navigation to the page's content (`.canopy-skip-link`) |
| `page:<key>` | The page's own frontmatter text for `<key>`, escaped; the slot's content when the page has none |

A control slot that has nothing to show on a page (no alternates for `language`, a manual page
for `back`) becomes nothing. An unknown slot name fails the build, and so does a control slot
with content: write `<canopy-slot name="search"></canopy-slot>` — HTML does not close a
custom tag written `<canopy-slot name="search"/>`, so it would take in what follows. Slots do
not nest and do not belong in `head`. A `page:` key whose value is not text (a list, a number,
a date) fails the build naming the page.

Slot names are part of this contract: adding one is a minor release, removing or changing one
is a breaking change. Each control keeps its look outside canopy's top bar — its styles hang on
its own class, not on where it sits.

## Not part of the contract

Depth classes for nested navigation and outline entries, the way elements nest inside a region,
and how icons are drawn are internal and may change in any release. A stylesheet that depends on
them works until they change; one written against the hooks above keeps working.
