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
    // `align-self: start` opts the sidebar out of that stretch so `height: 100vh` is
    // its own box, and `position: sticky` keeps that box pinned at the viewport top.
    expect(BASE_CSS).toMatch(/\.canopy-sidebar\s*\{[^}]*align-self:\s*start/);
    expect(BASE_CSS).toMatch(/\.canopy-sidebar\s*\{[^}]*position:\s*sticky/);
    expect(BASE_CSS).toMatch(/\.canopy-sidebar\s*\{[^}]*top:\s*0/);
    expect(BASE_CSS).toMatch(/\.canopy-sidebar\s*\{[^}]*height:\s*100vh/);
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

describe("navigation depth styling", () => {
  it("gives the sidebar tree a default weight distinction for its top level", () => {
    // `renderOutline` already exposes tree depth as `canopy-outline-l{n}`; the sidebar
    // nav renders the same kind of tree but never exposed depth at all, so no consumer
    // could style it by level without re-deriving depth from DOM nesting.
    expect(BASE_CSS).toMatch(/\.canopy-nav-l0\s*>\s*a,\s*\.canopy-nav-l0\s*>\s*span\s*\{[^}]*font-weight:\s*var\(--font-weight-semibold\)/);
  });
});
