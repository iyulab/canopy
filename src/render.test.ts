import { describe, expect, it } from "vitest";
import { visit, SKIP } from "unist-util-visit";
import { renderMarkdown, renderDocument } from "./render.js";

describe("renderMarkdown", () => {
  it("renders CommonMark headings and emphasis", async () => {
    const html = await renderMarkdown("# Title\n\nSome *emphasis*.");
    // rehype-slug adds an id so wikilink heading anchors resolve.
    expect(html).toContain('<h1 id="title">Title</h1>');
    expect(html).toContain("<em>emphasis</em>");
  });

  it("closes ** emphasis immediately followed by a CJK character", async () => {
    // Plain CommonMark treats the closing `**` as non-flanking here: the
    // character just inside it (a backtick, closing the code span) is
    // punctuation, and the character just outside it (a Korean particle) is
    // neither whitespace nor punctuation. Without CJK-aware handling this
    // renders as literal asterisks instead of closing the <strong>.
    const html = await renderMarkdown("**`강조`**를 확인합니다.");
    expect(html).toContain("<strong><code>강조</code></strong>를");
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
  // falls back to plain "text" — themed and backgrounded like every other
  // code block, just with no syntax coloring — rather than an unstyled <pre>
  // that reads as a different kind of element. A typo in a fence must never
  // cost a whole site build. The next three tests pin that contract.
  it("degrades an unknown language to plain-text highlighting, not a bare <pre>", async () => {
    const html = await renderMarkdown("```not-a-real-lang\nhello <world>\n```");
    expect(html).toContain("shiki");
    // The code survives verbatim, still escaped.
    expect(html).toContain("hello &#x3C;world>");
  });

  it("highlights a fence with no language the same way, as plain text", async () => {
    const html = await renderMarkdown("```\nplain text\n```");
    expect(html).toContain("shiki");
    expect(html).toContain("plain text");
  });

  it("renders an unknown language and no language identically — both are just \"text\"", async () => {
    const unknown = await renderMarkdown("```not-a-real-lang\nsame text\n```");
    const none = await renderMarkdown("```\nsame text\n```");
    expect(unknown).toBe(none);
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

describe("caller rehype plugins", () => {
  // A minimal stand-in for a real caller plugin (e.g. rehype-declart): claims
  // a `language-diagram` fence and replaces it with an element sanitize would
  // otherwise strip (an <svg>, absent from rehype-sanitize's default schema).
  // This is the shape verified live against the actual published
  // rehype-declart + its WASM binding before this extension point was built.
  function rehypeFence(tagName: string, className: string) {
    return () => (tree: import("hast").Root) => {
      visit(tree, "element", (node, index, parent) => {
        if (node.tagName !== "pre" || !parent || index == null) return;
        const code = node.children.find(
          (c): c is import("hast").Element =>
            c.type === "element" &&
            c.tagName === "code" &&
            Array.isArray(c.properties?.className) &&
            c.properties.className.includes(`language-${className}`),
        );
        if (!code) return;
        parent.children[index] = {
          type: "element",
          tagName,
          properties: {},
          children: [],
        };
        return [SKIP, index];
      });
    };
  }

  it("runs a caller's rehype plugin and keeps its output past sanitize", async () => {
    const html = await renderMarkdown("```diagram\nsource\n```", [
      rehypeFence("svg", "diagram"),
    ]);
    // <svg> is absent from rehype-sanitize's default schema — this only
    // survives because the plugin runs after sanitize, not before it.
    expect(html).toContain("<svg");
  });

  it("runs before Shiki, so the plugin sees the fence before Shiki claims it", async () => {
    const html = await renderMarkdown("```diagram\nsource\n```", [
      rehypeFence("svg", "diagram"),
    ]);
    expect(html).not.toContain("shiki");
  });

  it("leaves plain documents unaffected when no plugin claims anything", async () => {
    const withPlugin = await renderMarkdown("# Heading\n\ntext", [
      rehypeFence("svg", "diagram"),
    ]);
    const without = await renderMarkdown("# Heading\n\ntext");
    expect(withPlugin).toBe(without);
  });

  it("still sanitizes raw HTML a plugin does not claim", async () => {
    const html = await renderMarkdown("<script>alert(1)</script>", [
      rehypeFence("svg", "diagram"),
    ]);
    expect(html).not.toContain("<script>");
  });
});
