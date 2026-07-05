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
