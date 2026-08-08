import { describe, expect, it } from "vitest";
import { BASE_CSS } from "./styles.js";

/**
 * BASE_CSS has no other testable surface — no CSS-in-JS validation, no visual
 * regression harness — so these assert on the generated stylesheet text the
 * same way shell.test.ts asserts on generated HTML text.
 */
describe("sidebar scroll", () => {
  it("keeps the desktop sidebar pinned to the viewport, independent of main's scroll", () => {
    // A grid item stretches to the tallest sibling by default, so `.canopy-sidebar`
    // grows exactly as tall as `.canopy-main` and its own overflow never engages —
    // the whole page scrolls as one unit and the sidebar disappears upward with it.
    // `align-self: start` opts the sidebar out of that stretch so its box sizes to
    // its own content (capped below, not fixed), and `position: sticky` keeps that
    // box pinned at the viewport top.
    expect(BASE_CSS).toMatch(/\.canopy-sidebar\s*\{[^}]*align-self:\s*start/);
    expect(BASE_CSS).toMatch(/\.canopy-sidebar\s*\{[^}]*position:\s*sticky/);
    expect(BASE_CSS).toMatch(/\.canopy-sidebar\s*\{[^}]*top:\s*0/);
    // max-height, not a fixed height: now that .canopy-topbar can sit above
    // .canopy-layout in normal flow (see "top bar" describe block below), a
    // fixed 100vh would make the sidebar's box run exactly the topbar's
    // height past the bottom of the first viewport — visible on any site
    // whose nav list is close to filling the screen, the same symptom the
    // original stretch bug had. Sizing to content, capped at 100vh, only
    // engages overflow-y for a nav list that actually needs it.
    expect(BASE_CSS).toMatch(/\.canopy-sidebar\s*\{[^}]*max-height:\s*100vh/);
    expect(BASE_CSS).not.toMatch(/\.canopy-sidebar\s*\{[^}]*[^-]height:\s*100vh/);
  });

  it("releases the sticky pin on narrow screens, where the sidebar stacks above main", () => {
    // Below the mobile breakpoint the layout drops to a single column
    // (`grid-template-columns: 1fr`), so the sidebar is no longer beside `.canopy-main`
    // and a 100vh pin would instead force it to occupy the full screen permanently.
    const mobileBlock = BASE_CSS.match(/@media \(max-width: 40rem\) \{([\s\S]*)\}\s*$/)?.[1];
    expect(mobileBlock).toBeDefined();
    expect(mobileBlock).toMatch(/\.canopy-sidebar\s*\{[^}]*position:\s*static/);
  });
});

describe("sidebar column fill", () => {
  it("tints and divides the full column height via .canopy-layout's own background, not .canopy-sidebar's", () => {
    // .canopy-sidebar sizes to its own content (max-height: 100vh, not a
    // fixed height — see "sidebar scroll" above), so a nav list shorter than
    // the viewport no longer reaches the bottom of the column on its own.
    // .canopy-layout already spans the full row height regardless (its own
    // min-height: 100vh floor, or .canopy-main's height on a longer page),
    // so a hard-stopped gradient there reaches the bottom of the column for
    // any content length. It cannot live on .canopy-main instead: .canopy-main
    // centers a content-max-width column with its own side margins, so its
    // box doesn't reach the real column boundary above that max-width.
    expect(BASE_CSS).toMatch(
      /\.canopy-layout\s*\{[^}]*background:\s*linear-gradient\(\s*to right,\s*var\(--bg-secondary\)[^}]*var\(--border\)[^}]*var\(--bg-primary\)/,
    );
    // Scoped to the desktop rule, before the mobile breakpoint reintroduces
    // .canopy-sidebar's own background for its stacked block (below).
    const desktopCss = BASE_CSS.slice(0, BASE_CSS.indexOf("@media (max-width: 40rem)"));
    expect(desktopCss).not.toMatch(/\.canopy-sidebar\s*\{[^}]*background:/);
    expect(desktopCss).not.toMatch(/\.canopy-sidebar\s*\{[^}]*border-right:/);
  });

  it("derives the gradient's column-boundary stop from the same width the grid column uses, not a second literal", () => {
    // grid-template-columns and the gradient stop both encode "where the
    // sidebar column ends" — as two independently-written 16rem literals,
    // changing the sidebar's width would silently desync them (the grid
    // moves, the tint doesn't). A single custom property read by both sites
    // makes that impossible instead of merely documented against.
    const width = BASE_CSS.match(/--canopy-sidebar-w:\s*([^;]+);/)?.[1]?.trim();
    if (width === undefined) throw new Error("--canopy-sidebar-w is not declared in BASE_CSS");
    // Declared on .canopy-layout's own rule, not on a bare :root alongside
    // tokens.ts's --sp-*/--bg-* vocabulary — it exists to keep the two uses
    // below in sync with each other, not as a value callers read or override.
    expect(BASE_CSS).toMatch(/\.canopy-layout\s*\{\s*--canopy-sidebar-w:/);
    expect(BASE_CSS).toContain(`grid-template-columns: var(--canopy-sidebar-w) 1fr;`);
    expect(BASE_CSS).toContain(`var(--bg-secondary) var(--canopy-sidebar-w)`);
    expect(BASE_CSS).toContain(`var(--border) var(--canopy-sidebar-w)`);
    // Scoped to .canopy-layout's own rule body, not the whole stylesheet: the
    // claim under test is that this one rule doesn't repeat its width as a
    // second literal, not that the literal is globally unique — an unrelated
    // rule elsewhere coincidentally using the same value (e.g. a future
    // --content-max-width) would otherwise fail this test for the wrong
    // reason. Comments may mention the value in prose, so strip them first.
    const layoutRule = BASE_CSS.match(/\.canopy-layout\s*\{[^}]*\}/)?.[0];
    if (layoutRule === undefined) throw new Error(".canopy-layout rule not found in BASE_CSS");
    const layoutRuleCssOnly = layoutRule.replace(/\/\*[\s\S]*?\*\//g, "");
    const occurrences = layoutRuleCssOnly.split(width).length - 1;
    expect(occurrences).toBe(1);
  });

  it("resets to a plain fill on the single-column mobile layout, where .canopy-sidebar tints its own stacked block again", () => {
    // Below the breakpoint there is no column boundary left for a
    // left-to-right gradient to mark, and .canopy-sidebar's own (content-sized)
    // box is the whole of its row rather than a short box inside a taller one
    // — the same background on the sidebar itself reaches exactly as far as
    // the gradient would have.
    const mobileBlock = BASE_CSS.match(/@media \(max-width: 40rem\) \{([\s\S]*)\}\s*$/)?.[1];
    expect(mobileBlock).toBeDefined();
    expect(mobileBlock).toMatch(/\.canopy-layout\s*\{[^}]*background:\s*var\(--bg-primary\)/);
    expect(mobileBlock).toMatch(/\.canopy-sidebar\s*\{[^}]*background:\s*var\(--bg-secondary\)/);
  });
});

describe("comment safety", () => {
  it("never lets stray comment debris merge into the next rule's selector prelude", () => {
    // A literal "*/" inside comment prose (not just at the comment's intended
    // end) closes the comment early for a real CSS parser, even though the JS
    // string itself is untouched — every assertion elsewhere in this file
    // matches against BASE_CSS's raw string and cannot see this class of bug.
    // A prior comment ("tokens.ts's --sp-*/--bg-* vocabulary") did exactly
    // this: "--sp-*/" closed the comment mid-sentence, so the tail
    // ("--bg-* vocabulary: ...") became part of the *next* rule's selector
    // prelude. A parser treats "prelude then { }" as one unit — if the
    // prelude isn't a valid selector list, the whole rule is dropped, not
    // just the garbage text. That is what happened to .canopy-layout: it
    // parsed to zero rules in a real browser while every string-level test
    // here kept passing, because none of them checked what sits *between*
    // rules.
    //
    // This models that mechanism directly with the same first-"*/"-wins
    // stripping a CSS lexer does (a bare regex is enough for that part —
    // it's the "what's left before the next rule's {" check below that a
    // plain content match can't express), rather than parsing full CSS,
    // to avoid pulling in a parser dependency for one test.
    const stripped = BASE_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const selector of [".canopy-topbar", ".canopy-layout", ".canopy-sidebar", ".canopy-main", ".canopy-outline", ".canopy-backlinks"]) {
      const needle = `${selector} {`;
      const idx = stripped.indexOf(needle);
      expect(idx, `${selector} rule not found at all after stripping comments`).toBeGreaterThanOrEqual(0);
      const prevClose = stripped.lastIndexOf("}", idx);
      const between = stripped.slice(prevClose + 1, idx);
      expect(between.trim(), `text sits between the previous rule and ${needle} — a real parser would fold it into this rule's prelude and drop the whole rule`).toBe("");
    }
  });
});

describe("mobile navigation footprint", () => {
  it("caps the always-open nav list well under half the header's prior share of the screen", () => {
    // canopy ships the nav disclosure `open` unconditionally (no JS to remember a
    // closed state across page loads), so this cap is what a mobile reader sees
    // above the fold on every single page. Measured live (iyulab.github.io/canopy-page,
    // 375x667): the prior 40vh cap put the header+nav block at 66% of the viewport.
    expect(BASE_CSS).toContain(".canopy-nav > nav { max-height: 25vh; overflow-y: auto; }");
    expect(BASE_CSS).not.toContain("max-height: 40vh");
  });
});

describe("top bar", () => {
  it("spans the full width above the sidebar/main grid, not inside the sidebar", () => {
    // The header used to live inside .canopy-sidebar as .canopy-site-title; it now
    // renders as a sibling <header class="canopy-topbar"> before .canopy-layout
    // (see shell.ts), so its styling must target the new selector and must not
    // constrain itself to the sidebar's 16rem column.
    expect(BASE_CSS).toMatch(/\.canopy-topbar\s*\{/);
    expect(BASE_CSS).not.toMatch(/\.canopy-site-title\s*\{/);
  });

  it("still sizes the logo and dims the home link the same way it did in the sidebar", () => {
    expect(BASE_CSS).toMatch(/\.canopy-logo\s*\{[^}]*max-height:\s*1\.75rem/);
    expect(BASE_CSS).toMatch(/\.canopy-topbar\s*\.canopy-home\s*\{[^}]*color:\s*var\(--text-muted\)/);
  });

  it("wraps instead of forcing horizontal scroll on a narrow viewport", () => {
    // Unlike the sidebar's title block, which stacked in a column of its own
    // 16rem-wide box, the top bar lays its title and home link out in a row
    // that now spans the full page width — including on a phone. A long site
    // title plus a home link is a plausible combination that would otherwise
    // exceed the viewport and force horizontal scroll, since flex items don't
    // shrink below their content size by default.
    expect(BASE_CSS).toMatch(/\.canopy-topbar\s*\{[^}]*flex-wrap:\s*wrap/);
  });
});

describe("navigation depth styling", () => {
  it("gives the sidebar tree a default weight distinction for its top level", () => {
    // `renderOutline` already exposes tree depth as `canopy-outline-l{n}`; the sidebar
    // nav renders the same kind of tree but never exposed depth at all, so no consumer
    // could style it by level without re-deriving depth from DOM nesting.
    expect(BASE_CSS).toMatch(/\.canopy-nav-l0\s*>\s*a,\s*\.canopy-nav-l0\s*>\s*span\s*\{[^}]*font-weight:\s*var\(--font-weight-semibold\)/);
  });
});

/**
 * Finds the block opened by `marker` (its own literal text, ending in "{")
 * and returns everything up to its balanced closing "}". A plain regex can't
 * express "the matching brace" once the block's own content contains rules
 * of its own (each with a "{" and "}"), which is exactly the shape a media
 * query has — this is the same "avoid a parser dependency, model just enough
 * of the mechanism" approach the "comment safety" tests above already use.
 */
function extractBlock(css: string, marker: string): string {
  const start = css.indexOf(marker);
  if (start === -1) throw new Error(`marker not found: ${marker}`);
  let depth = 0;
  for (let i = start; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(start + marker.length, i);
    }
  }
  throw new Error(`unbalanced braces after marker: ${marker}`);
}

describe("on-page outline", () => {
  it("is pinned to the viewport like the sidebar once there is room for it beside the text", () => {
    // The outline used position: absolute, which leaves flow entirely and is
    // unaffected by scrolling — while .canopy-sidebar, a few rules away, has
    // used position: sticky since cycle-22. Two navigation aids in the same
    // shell behaving differently on scroll is an inconsistency a reader
    // notices, not a deliberate design (issue
    // ISSUE-canopy-20260808-topbar-and-toc-not-sticky, option C: outline
    // sticky, top bar left alone — the top bar has no equivalent "which
    // heading am I under" job that scrolling away would break).
    const desktopBlock = extractBlock(BASE_CSS, "@media (min-width: 75rem) {");
    expect(desktopBlock).toMatch(/\.canopy-outline\s*\{[^}]*position:\s*sticky/);
    expect(desktopBlock).not.toMatch(/\.canopy-outline\s*\{[^}]*position:\s*absolute/);
    expect(desktopBlock).toMatch(/\.canopy-outline\s*\{[^}]*top:\s*var\(--sp-8\)/);
  });

  it("reserves its own grid column instead of floating in .canopy-main's centering margin", () => {
    // position: absolute computed "beside the text" as an offset from
    // .canopy-main's own edge; position: sticky's inset properties instead
    // offset from the box's own in-flow position, so simply swapping the
    // position value would leave the outline in flow at the top of
    // .canopy-main (before .canopy-content, per the markup order in
    // shell.ts) rather than beside it. Placing .canopy-content, .canopy-outline
    // and .canopy-backlinks on an explicit grid is what keeps "beside" true
    // once "sticky" needs the box to stay in flow.
    const desktopBlock = extractBlock(BASE_CSS, "@media (min-width: 75rem) {");
    expect(desktopBlock).toMatch(/\.canopy-main:has\(\.canopy-outline\)\s*\{[^}]*display:\s*grid/);
    expect(desktopBlock).toMatch(/\.canopy-content\s*\{[^}]*grid-column:\s*1/);
    expect(desktopBlock).toMatch(/\.canopy-outline\s*\{[^}]*grid-column:\s*2/);
    expect(desktopBlock).toMatch(/\.canopy-backlinks\s*\{[^}]*grid-column:\s*1/);
  });

  it("only widens .canopy-main's centered column when there is an outline to make room for", () => {
    // A page short enough to skip the outline entirely (isOutlineUseful) has
    // no .canopy-outline element at all — :has() keeps that page's centered
    // 48rem column exactly as before instead of leaving a permanent gap where
    // an outline never renders.
    const desktopBlock = extractBlock(BASE_CSS, "@media (min-width: 75rem) {");
    expect(desktopBlock).toMatch(/\.canopy-main:has\(\.canopy-outline\)\s*\{[^}]*max-width:\s*calc\(var\(--content-max-width\)/);
    expect(desktopBlock).not.toMatch(/^\s*\.canopy-main\s*\{[^}]*display:\s*grid/m);
  });

  it("sizes to its own content within its grid area, the same align-self fix the sidebar already needed", () => {
    // .canopy-sidebar documents why a grid item needs align-self: start to
    // avoid stretching to its tallest sibling before position: sticky can do
    // anything useful; the outline is a grid item under the same rules once
    // it spans rows alongside .canopy-content and .canopy-backlinks.
    const desktopBlock = extractBlock(BASE_CSS, "@media (min-width: 75rem) {");
    expect(desktopBlock).toMatch(/\.canopy-outline\s*\{[^}]*align-self:\s*start/);
  });

  it("stacks above the article in normal flow below the breakpoint, unaffected by the desktop grid", () => {
    // Below 75rem there is no side-by-side column — the outline renders
    // wherever the markup places it (before .canopy-content, per shell.ts),
    // full width, exactly like before this change.
    const base = BASE_CSS.slice(0, BASE_CSS.indexOf("@media (min-width: 75rem)"));
    expect(base).toMatch(/\.canopy-outline\s*\{[^}]*border-left:\s*2px solid var\(--border\)/);
    expect(base).not.toMatch(/\.canopy-outline\s*\{[^}]*position:\s*sticky/);
  });
});

describe("main column shrink", () => {
  it("lets .canopy-main shrink below its own max-width instead of forcing the grid track wide", () => {
    // .canopy-main is a grid item of .canopy-layout at every width (mobile
    // included, where grid-template-columns drops to a single 1fr column).
    // Grid items default to min-width: auto, which uses the item's own
    // max-width as a floor on the *track's* size when nothing else on the
    // item constrains it smaller — so a 768px max-width kept the single
    // mobile column, and therefore the whole page, 768px wide regardless of
    // viewport. Reproduced on every page tried, including plain prose with
    // no table or unwrapped-width content, which rules out content as the
    // cause: getComputedStyle(.canopy-layout).gridTemplateColumns read
    // "768px" at a 375px viewport before this fix. min-width: 0 is the
    // standard escape from grid's (and flex's) default auto minimum.
    expect(BASE_CSS).toMatch(/\.canopy-main\s*\{[^}]*min-width:\s*0/);
  });
});
