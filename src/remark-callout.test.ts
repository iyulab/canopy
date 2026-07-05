import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./render.js";

/**
 * Callout transform: a top-level blockquote whose first line is `[!type]`
 * (optional title) becomes a styled callout; everything else stays a plain
 * blockquote. Recognition semantics are pinned case-by-case in
 * callout-parity.golden.json — these tests cover the HTML shape instead.
 */
describe("remark-callout", () => {
  it("transforms the marker line into a classed blockquote with a title", async () => {
    const html = await renderMarkdown("> [!note]\n> body");
    expect(html).toContain('<blockquote class="callout callout-note">');
    expect(html).toContain('<p class="callout-title">Note</p>');
    expect(html).toContain("body");
    expect(html).not.toContain("[!note]");
  });

  it("keeps an explicit title and preserves the typed word for aliases", async () => {
    const html = await renderMarkdown("> [!info] Heads up\n> body");
    expect(html).toContain('<blockquote class="callout callout-note">');
    expect(html).toContain('<p class="callout-title">Heads up</p>');
  });

  it("renders the header-only callout (empty body)", async () => {
    const html = await renderMarkdown("> [!warning]");
    expect(html).toContain('<blockquote class="callout callout-warning">');
    expect(html).toContain('<p class="callout-title">Warning</p>');
  });

  it("accepts and ignores fold markers", async () => {
    const html = await renderMarkdown("> [!note]- Folded\n> body");
    expect(html).toContain('<p class="callout-title">Folded</p>');
    expect(html).not.toContain("]-");
  });

  it("leaves plain blockquotes untouched", async () => {
    const html = await renderMarkdown("> just a quote");
    expect(html).toContain("<blockquote>");
    expect(html).not.toContain("callout");
  });

  it("leaves inline markdown in the body working", async () => {
    const html = await renderMarkdown("> [!tip]\n> **bold** stays bold");
    expect(html).toContain("<strong>bold</strong>");
  });
});

/**
 * Negative coverage for the sanitize schema extension: allowing the callout
 * classes must not widen the raw-HTML surface beyond those exact,
 * element-scoped class names. Pins measured pipeline behavior.
 */
describe("remark-callout sanitize surface", () => {
  it("strips scripts inside a callout body", async () => {
    const html = await renderMarkdown("> [!note] t\n> <script>alert(1)</script> body");
    expect(html).toContain('<p class="callout-title">t</p>');
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("alert(1)");
  });

  it("strips event handlers inside a callout body", async () => {
    const html = await renderMarkdown('> [!note]\n> <em onclick="alert(1)">em</em> and <img src=x onerror="alert(1)"> body');
    expect(html).toContain("<em>em</em>");
    expect(html).toContain('<img src="x">');
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("onerror");
  });

  it("strips classes outside the callout allowlist", async () => {
    const html = await renderMarkdown('<blockquote class="callout-evil pwned">x</blockquote>');
    expect(html).not.toContain("callout-evil");
    expect(html).not.toContain("pwned");
  });

  it("scopes the allowed classes to their elements", async () => {
    // callout-* is allowed on <blockquote> only, callout-title on <p> only.
    const forgedDiv = await renderMarkdown('<div class="callout-title">not a p</div>');
    expect(forgedDiv).not.toContain("callout-title");
    const forgedP = await renderMarkdown('<p class="callout callout-note">styled?</p>');
    expect(forgedP).not.toContain("callout-note");
  });

  it("lets authored blockquotes carry the exact callout classes (styling-only)", async () => {
    // The allowlist is origin-agnostic: authors can hand-write the classes
    // the transform emits. That yields styling only (no script surface), so
    // it is accepted rather than fought.
    const html = await renderMarkdown('<blockquote class="callout callout-danger"><p class="callout-title">Fake</p><p>body</p></blockquote>');
    expect(html).toContain('<blockquote class="callout callout-danger">');
    expect(html).toContain('<p class="callout-title">Fake</p>');
  });
});
