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

/**
 * CSS mask url() for a 24x24/2px-stroke icon, colored via `currentColor` or
 * `background-color` on whatever element applies the mask. Shared by the
 * callout icons and the theme toggle button below — one technique, one place
 * that knows how to turn a stroke path into a maskable data URI.
 */
function maskIcon(path: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='${path}'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Feather's "sun" icon (24x24, 2px stroke) — same convention as CALLOUT_ICON_PATHS. */
const THEME_TOGGLE_ICON_PATH =
  "M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42";

/** Feather's "menu" and "x" icons — the mobile nav disclosure's control, closed and open. */
const MOBILE_NAV_MENU_ICON_PATH = "M3 12h18M3 6h18M3 18h18";
const MOBILE_NAV_CLOSE_ICON_PATH = "M18 6 6 18M6 6l12 12";

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
/* A definite height, not max-height: a brand file supplies whatever it has,
   and a tall logo must not grow the bar past a single line — max-height would
   say that more precisely (cap, don't force), but it makes the logo's inline
   contribution to .canopy-topbar > a's own intrinsic width indefinite, and
   that indefinite replaced-element size is what the title text wraps around
   despite room to spare: measured live, the anchor's computed width came out
   equal to gap + text alone, as if the logo contributed zero, even though it
   paints at its correct capped size right next to that too-narrow box (a
   flex-basis:auto sizing gap most engines have for max-height-constrained
   replaced children, not anything specific to this logo or this text). A
   definite height gives the logo a definite aspect-ratio-derived width up
   front, which the anchor's intrinsic-size pass can add in like any other
   child — the trade is that a logo shorter than 1.75rem now scales up to fill
   it instead of sitting at its own smaller natural size. */
.canopy-logo { height: 1.75rem; max-width: 100%; width: auto; }
/* Specificity beats .canopy-topbar a without !important, which would also
   override a caller's own stylesheet. */
.canopy-topbar .canopy-home { font-weight: 400; font-size: 0.9em; color: var(--text-muted); }
.canopy-home::before { content: "← "; }

/* Pushed to the far edge of the bar when a title/logo/home shares it; alone,
   it simply starts the bar. Hidden by default (see shell.ts) until a
   caller-supplied script reveals it, so this rule only ever affects layout
   after that script has run. */
.canopy-search { margin-left: auto; }
.canopy-search input[type="search"] {
  font: inherit;
  padding: var(--sp-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-m);
  background: var(--bg-primary);
  color: var(--text-normal);
}

/* Hidden by default (see shell.ts) until a caller-supplied script reveals it
   — same reasoning as .canopy-search. margin-left: auto pushes it to the bar's
   right edge when nothing before it already claims that edge (i.e. no search);
   the override below keeps it from fighting search for the same space when
   both are present, so the pair reads as one right-aligned group. */
.canopy-theme-toggle {
  margin-left: auto;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border: none;
  background-color: var(--text-muted);
  -webkit-mask: ${maskIcon(THEME_TOGGLE_ICON_PATH)} center / contain no-repeat;
  mask: ${maskIcon(THEME_TOGGLE_ICON_PATH)} center / contain no-repeat;
  cursor: pointer;
}
.canopy-theme-toggle:hover { background-color: var(--text-normal); }
.canopy-search + .canopy-theme-toggle { margin-left: 0; }

/* The sidebar tint and its divider paint here as a hard-stopped gradient,
   not as .canopy-sidebar's own background/border. This container spans the
   full row height (min-height below, or .canopy-main's own height on a long
   page) independent of how tall any one cell's own content is, so a gradient
   here reaches the bottom of the column even when the sticky sidebar box
   inside it (below) is short. Painting it on .canopy-main instead — the
   seemingly obvious alternative — doesn't work: .canopy-main centers a
   content-max-width column with its own side margins, so its box doesn't
   reach the actual column boundary on any viewport wider than that max-width
   (measured live at 1280px: main's centered box left a visible gap between
   the sidebar and where main's own border would sit). The gradient is
   painted on this container's true coordinate space instead, so the stop
   always lands exactly on the grid's real column boundary regardless of
   what either child does with its own width — read from --canopy-sidebar-w
   rather than repeating the grid column's own 16rem as a second literal, so
   a future change to the sidebar's width cannot move one without the other.
   Reset on the mobile breakpoint below, where the grid drops to one column
   and there is no boundary left to mark this way.
   --canopy-sidebar-w is declared here, on the rule, not on :root alongside
   tokens.ts's --sp-* / --bg-* vocabulary: it exists only to keep the two
   declarations below in sync with each other, not as a value a caller is
   meant to read or override, so it isn't part of the design-token contract
   this file's own header comment already says the sidebar's width is not
   ("Sidebar width is a local layout constant, not a design token"). */
.canopy-layout {
  --canopy-sidebar-w: 16rem;
  display: grid;
  grid-template-columns: var(--canopy-sidebar-w) 1fr;
  min-height: 100vh;
  background: linear-gradient(
    to right,
    var(--bg-secondary) 0, var(--bg-secondary) var(--canopy-sidebar-w),
    var(--border) var(--canopy-sidebar-w), var(--border) calc(var(--canopy-sidebar-w) + 1px),
    var(--bg-primary) calc(var(--canopy-sidebar-w) + 1px), var(--bg-primary) 100%
  );
}

/* A grid item stretches to the tallest sibling by default, so without
   align-self this box would grow exactly as tall as .canopy-main and its own
   overflow-y would never engage — the whole page would scroll as one unit and
   the sidebar would disappear upward with it. align-self opts out of that
   stretch so max-height: 100vh is the sidebar's own box, and position: sticky
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
   the screen engages overflow-y — at the cost of the box no longer reaching
   the bottom of a short column on its own, which is why the tint and the
   divider (above, on .canopy-layout) don't live here anymore. */
.canopy-sidebar {
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

/* The page a reader is already on, styled the same way the on-page outline
   already styles read-only context: an accent color rather than a new
   background, so it works at every nav depth without a size change. */
.canopy-sidebar a[aria-current="page"] { color: var(--accent); font-weight: var(--font-weight-semibold); }

/* A disclosure that ships open: the desktop layout is unchanged and needs no
   override, while a narrow screen can collapse the list entirely.
   [open] is load-bearing, not decoration: a reader can close the disclosure on a
   narrow screen, then cross this breakpoint (e.g. rotating a phone to landscape)
   with it still closed. Hiding the summary unconditionally would strand them with
   no control to reopen it — hiding it only while open keeps a closed disclosure's
   control visible at every width. */
.canopy-nav[open] > summary { display: none; }

/* min-width: 0 overrides a grid item's default min-width: auto, which would
   otherwise use max-width as a floor on .canopy-layout's column track — on the
   single-column mobile layout that kept the whole page (not just this box)
   768px wide regardless of viewport, independent of what the page's own
   content was. */
.canopy-main {
  padding: var(--sp-8) var(--sp-6);
  max-width: var(--content-max-width);
  min-width: 0;
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
.canopy-content .callout-note { --callout-color: var(--callout-note); --callout-bg: var(--callout-note-bg); --callout-icon: ${maskIcon(CALLOUT_ICON_PATHS.note)}; }
.canopy-content .callout-tip { --callout-color: var(--callout-tip); --callout-bg: var(--callout-tip-bg); --callout-icon: ${maskIcon(CALLOUT_ICON_PATHS.tip)}; }
.canopy-content .callout-warning { --callout-color: var(--callout-warning); --callout-bg: var(--callout-warning-bg); --callout-icon: ${maskIcon(CALLOUT_ICON_PATHS.warning)}; }
.canopy-content .callout-danger { --callout-color: var(--callout-danger); --callout-bg: var(--callout-danger-bg); --callout-icon: ${maskIcon(CALLOUT_ICON_PATHS.danger)}; }
.canopy-content .callout-quote { --callout-color: var(--callout-quote); --callout-bg: var(--callout-quote-bg); --callout-icon: ${maskIcon(CALLOUT_ICON_PATHS.quote)}; }
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
  /* Room for a column beside the text. .canopy-content and .canopy-backlinks
     stay in one column; .canopy-outline gets a second, sized independently of
     .canopy-content's own max-width so a long line of prose can't push it
     around. Placed on an explicit grid (rather than the position: absolute
     this used before position: sticky replaced it below) because sticky's
     inset properties offset from the box's own in-flow position, not from a
     containing block's edge the way absolute's do — an explicit grid area is
     what keeps the outline "beside" the text once it also needs to stay in
     flow to be sticky at all.
     :has() scopes the wider column to pages that actually have an outline
     (isOutlineUseful in shell.ts) — without it, a page short enough to skip
     the outline would still carry the extra width as a permanent gap where
     an outline never renders. */
  .canopy-main:has(.canopy-outline) {
    max-width: calc(var(--content-max-width) + var(--sp-6) + 14rem);
    display: grid;
    grid-template-columns: minmax(0, 1fr) 14rem;
    column-gap: var(--sp-6);
    align-items: start;
  }
  .canopy-content { grid-column: 1; grid-row: 1; }
  .canopy-backlinks { grid-column: 1; grid-row: 2; }

  /* Grid row 1 / 3 spans both .canopy-content and .canopy-backlinks, so the
     outline can stay sticky for the full length of the article rather than
     just its own (much shorter) row. align-self: start is the same fix
     .canopy-sidebar already needed above: without it, a grid item stretches
     to match its spanned rows' combined height, and position: sticky has
     nothing to do inside a box that's already as tall as the space it could
     move through. */
  .canopy-outline {
    grid-column: 2;
    grid-row: 1 / 3;
    align-self: start;
    position: sticky;
    top: var(--sp-8);
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

/* Prev/next cards. margin-left: auto on .canopy-next is the same technique
   .canopy-search/.canopy-theme-toggle use to sit at the far edge of their
   row — here it keeps "next" flush right even when "prev" is absent (the
   first page), the same way it keeps "next" flush right in the top bar
   whether or not search sits before it. No grid placement is given for the
   wide layout below: unplaced, this lands in the next auto-placed row of
   column 1 (.canopy-outline's sticky span covers rows 1/3 — .canopy-content
   and .canopy-backlinks — so the outline tracks the article and stops
   there, not stretching beside cards that are no longer part of it). */
.canopy-page-nav {
  display: flex;
  gap: var(--sp-4);
  margin-top: var(--sp-8);
  padding-top: var(--sp-6);
  border-top: 1px solid var(--border);
}
.canopy-page-nav a { color: var(--accent); text-decoration: none; }
.canopy-page-nav a:hover { color: var(--accent-hover); text-decoration: underline; }
.canopy-prev::before { content: "← "; }
.canopy-next { margin-left: auto; text-align: right; }
.canopy-next::after { content: " →"; }

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
  /* One column now, so there is no column boundary left for the desktop
     gradient (above) to mark — reset to a plain fill. .canopy-sidebar takes
     its tint back here instead: stacked above .canopy-main rather than
     beside it, its own (content-sized) box is the whole of its row, so
     painting the tint there again reaches exactly as far as the gradient
     would have.
     min-height: auto releases the desktop min-height: 100vh floor, which
     existed only so that gradient reached the bottom of a short page — moot
     now that the background is a plain fill matching body's own (found live,
     dogfooding this shell: left in place, a single-column grid's implicit
     rows default to align-content: stretch, so the two rows (sidebar, main)
     were each stretched to fill 100vh between them even when their actual
     content was a small fraction of that — a closed nav's one-line disclosure
     rendered inside a tall, mostly-empty tinted box instead of hugging its
     own content, which read as broken rather than as a compact menu bar). */
  .canopy-layout {
    grid-template-columns: 1fr;
    min-height: auto;
    background: var(--bg-primary);
  }
  .canopy-sidebar {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    /* Release the desktop pin: a single-column layout has no "beside" for the
       sidebar to stay pinned against. The desktop max-height: 100vh is inert
       here anyway — the capped nav below keeps the sidebar's own content well
       under a full screen — but position: static (not sticky) is what actually
       matters, since a stray sticky element in a single column would otherwise
       still try to pin itself as the page scrolls. */
    align-self: auto;
    position: static;
  }
  /* Closed, the disclosure is just this control's own line — a cap would be
     inert here (there is nothing under it to clamp) but is declared anyway so
     an open disclosure that gains content still has one; see [open] below for
     what actually bounds it while open. */
  .canopy-nav > nav { max-height: 25vh; overflow-y: auto; }
  /* An icon, not the native disclosure marker: a visible word would have to be
     written in the site's language, which canopy cannot know — the same
     reason --home-label has no default. aria-label carries the meaning either
     way. list-style: none removes the native marker so ::before's icon is the
     only glyph. The [open] form is repeated (rather than left to the plain
     selector) because it is more specific and would otherwise win at every
     width, hiding the control on narrow screens too. */
  .canopy-nav[open] > summary,
  .canopy-nav > summary {
    display: flex;
    align-items: center;
    list-style: none;
    cursor: pointer;
    padding: var(--sp-3) 0;
    min-height: 2.75rem;
  }
  .canopy-nav[open] > summary::before,
  .canopy-nav > summary::before {
    content: "";
    width: 1.25rem;
    height: 1.25rem;
    background-color: var(--text-muted);
    -webkit-mask: ${maskIcon(MOBILE_NAV_MENU_ICON_PATH)} center / contain no-repeat;
    mask: ${maskIcon(MOBILE_NAV_MENU_ICON_PATH)} center / contain no-repeat;
  }
  /* Open swaps the icon to an "x": the control itself says what clicking it
     now does, rather than leaving the reader to infer "close" from the panel
     simply vanishing. */
  .canopy-nav[open] > summary::before {
    -webkit-mask-image: ${maskIcon(MOBILE_NAV_CLOSE_ICON_PATH)};
    mask-image: ${maskIcon(MOBILE_NAV_CLOSE_ICON_PATH)};
  }

  /* Open, the disclosure becomes a full-screen panel instead of the in-flow,
     25vh-capped block above. Replaces that clamp-and-scroll treatment for
     both of its defects: a full nav that pushed page content down when open
     (the original problem), and — found live, dogfooding this shell — a
     closed control that still sat inside an oversized tinted band (.canopy-
     sidebar's own padding/background), which read as a layout that had
     broken rather than a compact menu bar. A full-screen panel has no
     "oversized when closed" state to have, because closed is once again just
     this control's own line — the fix removes the second defect's cause
     rather than clamping its symptom. */
  .canopy-nav[open] {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    padding: 0 var(--sp-4);
    background: var(--bg-secondary);
    overflow-y: auto;
  }
  .canopy-nav[open] > nav {
    max-height: none;
    flex: 1;
  }
  /* The page behind a full-screen panel must not also scroll — scoped to this
     breakpoint alone, since .canopy-nav ships [open] in the HTML unconditionally
     (no JS to remember a closed state — SCOPE.md's no-JS non-goal) and this
     selector would otherwise hide scrolling on every desktop page too. */
  body:has(.canopy-nav[open]) { overflow: hidden; }
}
`;
