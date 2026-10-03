# Theming

A site canopy emits looks finished with no styling of its own, and every part of it can be
restyled. This document is the contract for doing that: where canopy's CSS sits in the cascade,
which names a stylesheet can rely on, and which it cannot.

## Your CSS always wins

Everything canopy writes — `tokens.css`, `styles.css`, and the KaTeX stylesheet when a page has
math — is wrapped in one [cascade layer](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer),
`canopy`. A rule outside any layer beats every layered rule regardless of specificity, so a
stylesheet you supply wins over canopy's without a specificity contest:

```sh
canopy build notes site --stylesheet brand.css --stylesheet layout.css
```

```ts
emitSite(bundle, { styles: [brandCss, layoutCss] });
```

Each is written to `assets/stylesheet-<n>.css` and linked after canopy's own, in the order given.
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

## Hooks

These class names are stable: renaming or removing one is a breaking change, announced in the
changelog. Select on them freely.

| Region | Hooks |
|---|---|
| Top bar | `.canopy-topbar` `.canopy-topbar-controls` `.canopy-logo` `.canopy-home` `.canopy-home-external` `.canopy-breadcrumb` `.canopy-search` `.canopy-theme-toggle` |
| Layout and navigation | `.canopy-layout` `.canopy-sidebar` `.canopy-nav` `.canopy-nav-group` `.canopy-main` |
| Article | `.canopy-content` `.canopy-contents` `.canopy-date` `.canopy-listing` `.canopy-listing-title` |
| Callouts | `.callout` `.callout-note` `.callout-tip` `.callout-warning` `.callout-danger` `.callout-quote` `.callout-title` |
| Around the article | `.canopy-outline` `.canopy-backlinks` `.canopy-page-nav` `.canopy-prev` `.canopy-next` |

State is read from standard attributes, not classes: `aria-current="page"` on the current page's
link, `[open]` on a disclosure, `[hidden]` on a control no script has revealed.

```css
/* A wider article and no sidebar — plain selectors, no specificity to match.
   The layout paints the sidebar column's tint as its own background, so it
   goes with the column. */
:root { --content-max-width: 60rem; }
.canopy-sidebar { display: none; }
.canopy-layout { grid-template-columns: 1fr; background: none; }
```

## Not part of the contract

Depth classes for nested navigation and outline entries, the way elements nest inside a region,
and how icons are drawn are internal and may change in any release. A stylesheet that depends on
them works until they change; one written against the hooks above keeps working.
