import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./render.js";
import { build } from "./index.js";

describe("rehype-heading-id", () => {
  it("takes a trailing {#id} as the heading's id and strips it from the text", async () => {
    const html = await renderMarkdown("## Which screen {#which-one}");
    expect(html).toContain('<h2 id="which-one">Which screen</h2>');
    expect(html).not.toContain("{#which-one}");
  });

  it("wins over the id github-slugger would otherwise derive from the wording", async () => {
    const html = await renderMarkdown("## Season and blocks {#season}");
    expect(html).toContain('id="season"');
    expect(html).not.toContain("season-and-blocks");
  });

  it("leaves a heading with no trailing marker to github-slugger, unchanged", async () => {
    const html = await renderMarkdown("## Plain heading");
    expect(html).toContain('<h2 id="plain-heading">Plain heading</h2>');
  });

  it("works at every heading level", async () => {
    const html = await renderMarkdown("### Sub heading {#sub}\n\n# Top heading {#top}");
    expect(html).toContain('<h3 id="sub">Sub heading</h3>');
    expect(html).toContain('<h1 id="top">Top heading</h1>');
  });

  it("does not treat a mid-sentence {#foo} as an id declaration", async () => {
    // No leading whitespace before the closing word, and not at the very end
    // of the heading's text — kramdown's own header-attribute syntax draws
    // the same line, so a heading that happens to *mention* braces in prose
    // is not silently id'd from an unrelated fragment of its own wording.
    const html = await renderMarkdown("## Talking about {#foo} in the middle of a title");
    expect(html).toContain("{#foo}");
    expect(html).toContain('id="talking-about-foo-in-the-middle-of-a-title"');
  });

  it("requires whitespace before the marker, not a bare suffix glued to a word", async () => {
    const html = await renderMarkdown("## Heading{#glued}");
    expect(html).toContain("{#glued}");
    expect(html).not.toContain('id="glued"');
  });

  it("survives inline formatting before the marker", async () => {
    const html = await renderMarkdown("## The `status` field {#status-field}");
    expect(html).toContain('<h2 id="status-field">The <code>status</code> field</h2>');
  });

  it("reaches the page's own outline with clean text and the stable id, not the literal marker", async () => {
    // This is the actually-reported symptom: a page's on-page outline (built
    // from the same rendered HTML, see outline.ts) showed "{#which-one}" as
    // part of the entry's own text, because nothing upstream had ever
    // recognized the marker as anything but prose.
    const bundle = await build({
      documents: [
        {
          path: "index.md",
          content: "# Home\n\n## Which screen {#which-one}\n\ntext\n\n## Second {#second}\n\nmore",
        },
      ],
    });
    const outline = bundle.pages[0]?.outline;
    expect(outline).toEqual([
      { level: 2, text: "Which screen", id: "which-one" },
      { level: 2, text: "Second", id: "second" },
    ]);
  });
});
