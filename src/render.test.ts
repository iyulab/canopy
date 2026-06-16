import { describe, expect, it } from "vitest";
import { renderMarkdown, renderDocument } from "./render.js";

describe("renderMarkdown", () => {
  it("renders CommonMark headings and emphasis", async () => {
    const html = await renderMarkdown("# Title\n\nSome *emphasis*.");
    // rehype-slug adds an id so wikilink heading anchors resolve.
    expect(html).toContain('<h1 id="title">Title</h1>');
    expect(html).toContain("<em>emphasis</em>");
  });

  it("renders GFM tables", async () => {
    const html = await renderMarkdown("| a | b |\n| - | - |\n| 1 | 2 |");
    expect(html).toContain("<table>");
    expect(html).toContain("<td>1</td>");
  });

  it("renders GFM strikethrough and task lists", async () => {
    const html = await renderMarkdown("~~gone~~\n\n- [x] done\n- [ ] todo");
    expect(html).toContain("<del>gone</del>");
    expect(html).toContain('type="checkbox"');
  });

  it("strips dangerous raw HTML (scripts) while preserving safe tags", async () => {
    const html = await renderMarkdown(
      "Press <kbd>Enter</kbd>.<script>alert(1)</script>",
    );
    expect(html).toContain("<kbd>Enter</kbd>");
    expect(html).not.toContain("<script>");
  });

  it("preserves safe authoring HTML like <details>", async () => {
    const html = await renderMarkdown(
      "<details><summary>More</summary>hidden</details>",
    );
    expect(html).toContain("<details>");
    expect(html).toContain("<summary>More</summary>");
  });

  it("renders inline and block math with KaTeX", async () => {
    const html = await renderMarkdown("Inline $E=mc^2$ and $$\\int_0^1 x$$");
    expect(html).toContain('class="katex"');
    // The TeX source survives in the MathML annotation, not as literal text.
    expect(html).toContain("E=mc^2");
  });

  it("highlights fenced code blocks with Shiki", async () => {
    const html = await renderMarkdown("```js\nconst x = 1;\n```");
    expect(html).toContain("shiki");
    expect(html).toContain("style=");
    expect(html).toContain("const");
  });

  it("is deterministic for the same input", async () => {
    const md = "# Same\n\ntext $a+b$\n\n```ts\nlet y = 2;\n```";
    expect(await renderMarkdown(md)).toBe(await renderMarkdown(md));
  });
});

describe("renderDocument", () => {
  it("extracts frontmatter and keeps it out of the HTML", async () => {
    const { frontmatter, html } = await renderDocument(
      "---\ntitle: Page\n---\n# Heading\n",
    );
    expect(frontmatter).toEqual({ title: "Page" });
    expect(html).toContain('<h1 id="heading">Heading</h1>');
    expect(html).not.toContain("title: Page");
  });
});
