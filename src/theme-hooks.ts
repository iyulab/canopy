/**
 * The class names a caller's stylesheet or script may rely on: canopy's public
 * styling contract, documented in docs/THEMING.md.
 *
 * Renaming or removing one is a breaking change, announced in the CHANGELOG.
 * Anything else canopy emits — the depth classes `canopy-nav-l<n>` and
 * `canopy-outline-l<n>`, how elements nest inside a region, how an icon is
 * drawn — is internal and may change in any release. State is read from
 * standard attributes rather than classes: `aria-current="page"`, `[open]`,
 * `[hidden]`, and `data-theme` on `<html>`.
 */
export const THEME_HOOKS: readonly string[] = [
  // Top bar
  "canopy-topbar",
  "canopy-topbar-controls",
  "canopy-logo",
  "canopy-home",
  "canopy-home-external",
  "canopy-breadcrumb",
  "canopy-search",
  "canopy-theme-toggle",
  // Layout and navigation
  "canopy-layout",
  "canopy-sidebar",
  "canopy-nav",
  "canopy-nav-group",
  "canopy-main",
  // Article
  "canopy-content",
  "canopy-contents",
  "canopy-date",
  "canopy-listing",
  "canopy-listing-title",
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
  "canopy-prev",
  "canopy-next",
];
