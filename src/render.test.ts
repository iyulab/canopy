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

  // How a fence whose language cannot be resolved renders is a contract, not
  // an accident: highlighting is best-effort, so an unresolvable language
  // degrades to a plain code block. A typo in a fence must never cost a whole
  // site build. The next three tests pin that contract from both sides.
  it("degrades an unknown language to a plain code block", async () => {
    const html = await renderMarkdown("```not-a-real-lang\nhello <world>\n```");
    expect(html).toContain('<code class="language-not-a-real-lang">');
    expect(html).not.toContain("shiki");
    // The code survives verbatim, still escaped.
    expect(html).toContain("hello &#x3C;world>");
  });

  it("leaves a fence with no language as a plain code block", async () => {
    const html = await renderMarkdown("```\nplain text\n```");
    expect(html).toContain("<pre><code>plain text");
    expect(html).not.toContain("shiki");
  });

  it("highlights a language beyond the ones loaded up front", async () => {
    const html = await renderMarkdown("```rust\nfn main() { let x: i32 = 1; }\n```");
    expect(html).toContain("shiki");
    expect(html).toContain("fn");
  });

  // In a language nothing else here renders, so this sees a grammar's very
  // first use. Shiki tokenizes differently the first time with a newly loaded
  // grammar; without the warm-up in render.ts that would leave the first code
  // block of a site — every site, since a build is a fresh process — styled
  // unlike every other one.
  it("renders a language the same on its first use as on its second", async () => {
    const md = "```lua\nlocal x = 1\n```";
    expect(await renderMarkdown(md)).toBe(await renderMarkdown(md));
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
