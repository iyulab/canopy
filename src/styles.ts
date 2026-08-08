/**
 * Callout icon path data (24x24 viewBox, 2px stroke). Consuming editors keep
 * a byte-identical copy so the published page and the editor draw the same
 * glyphs; update every copy together.
 */
export const CALLOUT_ICON_PATHS = {
  note: "M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z",
  tip: "M9 18h6M10 22h4M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14",
  warning: "m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01",
  danger: "M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86L7.86 2zM12 8v4M12 16h.01",
  quote: "M10 11H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6a4 4 0 0 1-4 4M20 11h-4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6a4 4 0 0 1-4 4",
} as const;

/** CSS mask url() for one callout icon — colored via background-color on the ::before. */
function calloutIcon(path: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='${path}'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

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

/* Full-width header, above the sidebar/main grid rather than inside the
   sidebar's 16rem column — a site title and a home link read as belonging to
   the whole page, not to the navigation panel. Absent when the settings give
   canopy neither a title, a logo, nor a home link (see shell.ts), so a site
   with none of those keeps today's chrome-free top edge. */
.canopy-topbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-4);
  padding: var(--sp-3) var(--sp-4);
  border-bottom: 1px solid var(--border);
  font-weight: var(--font-weight-semibold);
}
.canopy-topbar > a:not(.canopy-home) { display: flex; align-items: center; gap: var(--sp-2); }
/* Capped rather than sized: a brand file supplies whatever it has, and a tall
   logo must not grow the bar past a single line. */
.canopy-logo { max-height: 1.75rem; max-width: 100%; width: auto; }
/* Specificity beats .canopy-topbar a without !important, which would also
   override a caller's own stylesheet. */
.canopy-topbar .canopy-home { font-weight: 400; font-size: 0.9em; color: var(--text-muted); }
.canopy-home::before { content: "← "; }

.canopy-layout {
  display: grid;
  grid-template-columns: 16rem 1fr;
  min-height: 100vh;
}

/* A grid item stretches to the tallest sibling by default, so without
   align-self this box would grow exactly as tall as .canopy-main and its own
   overflow-y would never engage — the whole page would scroll as one unit and
   the sidebar would disappear upward with it. align-self opts out of that
   stretch so height: 100vh is the sidebar's own box, and position: sticky
   keeps that box pinned at the viewport top while .canopy-main scrolls past
   it. The mobile breakpoint below releases all three: a single-column layout
   has no "beside" for the sidebar to stay pinned against.
   100vh here is the sidebar's full height in isolation; with .canopy-topbar
   as a sibling above .canopy-layout rather than inside it, the topbar's own
   height already comes out of the viewport before .canopy-layout starts, so
   this doesn't need to account for it. It does need to give up a fixed
   height, though: with .canopy-topbar in normal flow above .canopy-layout,
   a flat 100vh would run the sidebar's box exactly the topbar's height past
   the bottom of the first viewport. max-height caps it there instead, so a
   short nav sizes to its own content and only a nav list that actually fills
   the screen engages overflow-y. */
.canopy-sidebar {
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  padding: var(--sp-6) var(--sp-4);
  align-self: start;
  position: sticky;
  top: 0;
  max-height: 100vh;
  overflow-y: auto;
}

.canopy-sidebar ul { list-style: none; margin: 0; padding-left: var(--sp-3); }
.canopy-nav > nav > ul { padding-left: 0; }
.canopy-sidebar a { color: var(--text-normal); text-decoration: none; }
.canopy-sidebar a:hover { color: var(--accent); text-decoration: underline; }
.canopy-sidebar span { color: var(--text-muted); }
/* Minimal default hierarchy: only the top level is distinguished, matching the
   minimal-configuration principle already applied to Wave 1 (no predefined
   multi-level color themes) — a consumer who wants more can target
   .canopy-nav-l{n} directly, now that depth is exposed in the markup. */
.canopy-nav-l0 > a, .canopy-nav-l0 > span { font-weight: var(--font-weight-semibold); }

/* A disclosure that ships open: the desktop layout is unchanged and needs no
   override, while a narrow screen can collapse the list entirely.
   [open] is load-bearing, not decoration: a reader can close the disclosure on a
   narrow screen, then cross this breakpoint (e.g. rotating a phone to landscape)
   with it still closed. Hiding the summary unconditionally would strand them with
   no control to reopen it — hiding it only while open keeps a closed disclosure's
   control visible at every width. */
.canopy-nav[open] > summary { display: none; }

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

/* Callouts (\`> [!type]\`): tinted blockquotes with an icon + title line.
   Color comes from the callout tokens; the icon is a masked SVG so it
   follows the type color with no inline markup in the page. */
.canopy-content .callout {
  margin: var(--sp-4) 0;
  padding: var(--sp-3) var(--sp-4);
  border-left: 3px solid var(--callout-color);
  border-radius: var(--radius-m);
  background: var(--callout-bg);
}
.canopy-content .callout-note { --callout-color: var(--callout-note); --callout-bg: var(--callout-note-bg); --callout-icon: ${calloutIcon(CALLOUT_ICON_PATHS.note)}; }
.canopy-content .callout-tip { --callout-color: var(--callout-tip); --callout-bg: var(--callout-tip-bg); --callout-icon: ${calloutIcon(CALLOUT_ICON_PATHS.tip)}; }
.canopy-content .callout-warning { --callout-color: var(--callout-warning); --callout-bg: var(--callout-warning-bg); --callout-icon: ${calloutIcon(CALLOUT_ICON_PATHS.warning)}; }
.canopy-content .callout-danger { --callout-color: var(--callout-danger); --callout-bg: var(--callout-danger-bg); --callout-icon: ${calloutIcon(CALLOUT_ICON_PATHS.danger)}; }
.canopy-content .callout-quote { --callout-color: var(--callout-quote); --callout-bg: var(--callout-quote-bg); --callout-icon: ${calloutIcon(CALLOUT_ICON_PATHS.quote)}; }
.canopy-content .callout-title {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin: 0 0 var(--sp-2);
  font-weight: var(--font-weight-semibold);
  color: var(--callout-color);
}
.canopy-content .callout-title::before {
  content: "";
  width: 1.1em;
  height: 1.1em;
  flex: none;
  background-color: var(--callout-color);
  -webkit-mask: var(--callout-icon) center / contain no-repeat;
  mask: var(--callout-icon) center / contain no-repeat;
}
.canopy-content .callout > :last-child { margin-bottom: 0; }
.canopy-content .callout > p { margin: var(--sp-2) 0; }

/* On-this-page outline. Beside the text on a wide screen, above it when there is
   no room — a plain anchor list, no script, like the rest of the shell. */
.canopy-outline {
  margin: 0 0 var(--sp-6);
  padding: var(--sp-3) var(--sp-4);
  border-left: 2px solid var(--border);
  font-size: 0.9em;
}
.canopy-outline ul { list-style: none; margin: 0; padding: 0; }
.canopy-outline li { margin: var(--sp-2) 0; }
.canopy-outline a { color: var(--text-muted); text-decoration: none; }
.canopy-outline a:hover { color: var(--accent); text-decoration: underline; }
.canopy-outline-l1 { padding-left: var(--sp-4); }
.canopy-outline-l2 { padding-left: var(--sp-6); }

@media (min-width: 75rem) {
  /* Room for a column beside the text: float the outline out of the flow so the
     prose keeps its measure instead of narrowing to make space. */
  .canopy-main { position: relative; }
  .canopy-outline {
    position: absolute;
    top: var(--sp-8);
    left: calc(100% + var(--sp-6));
    width: 14rem;
    margin: 0;
  }
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
    /* Release the desktop pin: a single-column layout has no "beside" for the
       sidebar to stay pinned against. The desktop max-height: 100vh is inert
       here anyway — the capped nav below keeps the sidebar's own content well
       under a full screen — but position: static (not sticky) is what actually
       matters, since a stray sticky element in a single column would otherwise
       still try to pin itself as the page scrolls. */
    align-self: auto;
    position: static;
    height: auto;
  }
  /* Without a cap, a site of any size puts its whole navigation above the first
     line of every page. canopy ships this disclosure open unconditionally (no
     JS to remember a closed state across page loads — see SCOPE.md's no-JS
     non-goal), so this cap is what every mobile reader sees above the fold on
     every single page, not just the first. Measured live at 25vh: the header +
     nav block is ~46-51% of common phone viewports, down from ~61-66% at the
     previous 40vh. Reader-controlled closing (the disclosure's own toggle)
     remains available underneath the cap either way. */
  .canopy-nav > nav { max-height: 25vh; overflow-y: auto; }
  /* The native disclosure marker and nothing else: a visible word would have to
     be written in the site's language, which canopy cannot know — the same reason
     --home-label has no default. The aria-label carries the meaning.
     The [open] form is repeated here (rather than left to the rule above) because
     it is more specific than this selector alone and would otherwise win at every
     width, hiding the control on narrow screens too. */
  .canopy-nav[open] > summary,
  .canopy-nav > summary {
    display: list-item;
    list-style-position: inside;
    cursor: pointer;
    color: var(--text-muted);
    padding: var(--sp-3) 0;
    min-height: 2.75rem;
  }
}
`;
