import { describe, expect, it } from "vitest";
import { extractOutline, isOutlineUseful } from "./outline.js";

describe("extractOutline", () => {
  it("collects h2 and h3 with their ids, in document order", () => {
    const html = [
      '<h1 id="title">Title</h1>',
      '<h2 id="first">First</h2>',
      "<p>Body</p>",
      '<h3 id="detail">Detail</h3>',
      '<h2 id="second">Second</h2>',
    ].join("");
    expect(extractOutline(html)).toEqual([
      { level: 2, text: "First", id: "first" },
      { level: 3, text: "Detail", id: "detail" },
      { level: 2, text: "Second", id: "second" },
    ]);
  });

  it("omits h1 and levels below h3", () => {
    const html = [
      '<h1 id="a">A</h1>',
      '<h4 id="b">B</h4>',
      '<h5 id="c">C</h5>',
      '<h6 id="d">D</h6>',
    ].join("");
    // h1 is the page's own title; h4+ is detail a contents list does not need.
    expect(extractOutline(html)).toEqual([]);
  });

  it("strips inline markup from heading text", () => {
    const html = '<h2 id="x">Use <code>build()</code> <em>now</em></h2>';
    expect(extractOutline(html)[0]?.text).toBe("Use build() now");
  });

  it("decodes entities so the outline reads like the heading", () => {
    const html = '<h2 id="x">Tags &amp; &lt;braces&gt; &quot;quoted&quot;</h2>';
    expect(extractOutline(html)[0]?.text).toBe('Tags & <braces> "quoted"');
  });

  it("skips a heading with no id, which nothing could link to", () => {
    const html = '<h2>Unanchored</h2><h2 id="ok">Anchored</h2>';
    expect(extractOutline(html)).toEqual([{ level: 2, text: "Anchored", id: "ok" }]);
  });

  it("skips an empty heading", () => {
    expect(extractOutline('<h2 id="empty"></h2>')).toEqual([]);
  });

  it("handles attributes in any order and extra whitespace", () => {
    const html = '<h2 class="x" id="y" data-z="1">Text</h2>';
    expect(extractOutline(html)).toEqual([{ level: 2, text: "Text", id: "y" }]);
  });

  it("does not confuse nested tags for the closing heading", () => {
    const html = '<h2 id="a">One <span>two</span> three</h2><h2 id="b">Next</h2>';
    expect(extractOutline(html).map((i) => i.text)).toEqual(["One two three", "Next"]);
  });

  it("returns nothing for a page with no headings", () => {
    expect(extractOutline("<p>Just prose.</p>")).toEqual([]);
  });
});

describe("isOutlineUseful", () => {
  it("needs at least two entries to be worth showing", () => {
    expect(isOutlineUseful([])).toBe(false);
    expect(isOutlineUseful([{ level: 2, text: "Only", id: "only" }])).toBe(false);
    expect(
      isOutlineUseful([
        { level: 2, text: "A", id: "a" },
        { level: 2, text: "B", id: "b" },
      ]),
    ).toBe(true);
  });
});
