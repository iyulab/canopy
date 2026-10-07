/**
 * The class names a caller's stylesheet or script may rely on: canopy's public
 * styling contract, documented in docs/THEMING.md.
 * Some hooks appear only where the page has that part — .canopy-topbar only when canopy
 * draws its own top bar (a site's header fragment replaces it), .canopy-sidebar only on a
 * manual page — so the contract is what each name means where it appears, not that every page
 * carries every one.
 *
 * Renaming or removing one is a breaking change, announced in the CHANGELOG.
 * Anything else canopy emits — the depth classes `canopy-nav-l<n>` and
 * `canopy-outline-l<n>`, how elements nest inside a region, how an icon is
 * drawn — is internal and may change in any release. State is read from
 * standard attributes rather than classes: `aria-current="page"`, `[open]`,
 * `[hidden]`, and `data-theme` on `<html>`.
 */
export const THEME_HOOKS = Object.freeze([
  // Top bar, and the controls a site's own header can place through slots
  "canopy-topbar",
  "canopy-topbar-controls",
  "canopy-site-title",
  "canopy-logo",
  "canopy-home",
  "canopy-home-external",
  "canopy-back",
  "canopy-breadcrumb",
  "canopy-language",
  "canopy-search",
  "canopy-theme-toggle",
  "canopy-skip-link",
  // Layout and navigation
  "canopy-layout",
  "canopy-sidebar",
  "canopy-nav",
  "canopy-nav-group",
  "canopy-main",
  // Article
  "canopy-content",
  "canopy-contents",
  "canopy-before-article",
  "canopy-after-article",
  "canopy-lead",
  "canopy-byline",
  "canopy-author",
  "canopy-date",
  "canopy-reading-time",
  "canopy-cover",
  "canopy-toc",
  "canopy-listing",
  "canopy-listing-title",
  "canopy-pagination",
  "canopy-tags",
  "canopy-tag-index",
  "canopy-tag-count",
  "canopy-tag-index-link",
  "canopy-read-next",
  "canopy-table",
  "callout",
  "callout-note",
  "callout-tip",
  "callout-warning",
  "callout-danger",
  "callout-quote",
  "callout-title",
  // Around the article
  "canopy-outline",
  "canopy-backlinks",
  "canopy-page-nav",
  "canopy-page-nav-label",
  "canopy-prev",
  "canopy-next",
] as const);

/** One of canopy's public class names. */
export type ThemeHook = (typeof THEME_HOOKS)[number];
