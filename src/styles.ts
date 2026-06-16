/**
 * Base layout stylesheet for the published site shell.
 *
 * Every color, font, and spacing value is a shared design token (see
 * `tokens.ts`) so the published site tracks the consuming app's look. This
 * file owns only layout and structure — the tokens own the palette/type.
 * Sidebar width is a local layout constant, not a design token.
 */
export const BASE_CSS = `* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: var(--font-ui);
  font-size: var(--font-size-editor);
  color: var(--text-normal);
  background: var(--bg-primary);
  line-height: var(--line-height-relaxed);
}

.canopy-layout {
  display: grid;
  grid-template-columns: 16rem 1fr;
  min-height: 100vh;
}

.canopy-sidebar {
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  padding: var(--sp-6) var(--sp-4);
  overflow-y: auto;
}

.canopy-site-title {
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--sp-4);
}
.canopy-sidebar ul { list-style: none; margin: 0; padding-left: var(--sp-3); }
.canopy-sidebar > nav > ul { padding-left: 0; }
.canopy-sidebar a { color: var(--text-normal); text-decoration: none; }
.canopy-sidebar a:hover { color: var(--accent); text-decoration: underline; }
.canopy-sidebar span { color: var(--text-muted); }

.canopy-main {
  padding: var(--sp-8) var(--sp-6);
  max-width: var(--content-max-width);
  margin: 0 auto;
  width: 100%;
}

.canopy-content a { color: var(--accent); }
.canopy-content a:hover { color: var(--accent-hover); }
.canopy-content img { max-width: 100%; height: auto; }
.canopy-content pre {
  padding: var(--sp-4);
  border-radius: var(--radius-m);
  overflow-x: auto;
}
.canopy-content code { font-family: var(--font-monospace); }
.canopy-content table { border-collapse: collapse; }
.canopy-content th, .canopy-content td {
  border: 1px solid var(--border);
  padding: var(--sp-2) var(--sp-3);
}

.canopy-backlinks {
  margin-top: var(--sp-8);
  padding-top: var(--sp-6);
  border-top: 1px solid var(--border);
  font-size: 0.9em;
}
.canopy-backlinks h2 { font-size: 1em; color: var(--text-muted); }
.canopy-backlinks a { color: var(--accent); }
.canopy-backlinks a:hover { color: var(--accent-hover); }

/* Shiki dual-theme: swap to the dark palette via the CSS variables Shiki
   emits (--shiki-dark*), so code blocks match the page's color scheme. */
@media (prefers-color-scheme: dark) {
  .shiki,
  .shiki span {
    color: var(--shiki-dark) !important;
    background-color: var(--shiki-dark-bg) !important;
  }
}

@media (max-width: 40rem) {
  .canopy-layout { grid-template-columns: 1fr; }
  .canopy-sidebar {
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
}
`;
