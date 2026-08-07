import { describe, expect, it } from "vitest";
import { extractOutline, extractFirstHeading, isOutlineUseful } from "./outline.js";

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

describe("extractFirstHeading", () => {
  it("reads the document's own title from its first h1", () => {
    expect(extractFirstHeading('<h1 id="order-list">주문 목록</h1><p>Body</p>')).toBe(
      "주문 목록",
    );
  });

  it("strips inline markup, the same way the outline does", () => {
    expect(extractFirstHeading('<h1 id="x">Use <code>build()</code> <em>now</em></h1>')).toBe(
      "Use build() now",
    );
  });

  it("decodes entities so the name reads like the heading", () => {
    expect(extractFirstHeading('<h1 id="x">Tags &amp; &lt;braces&gt;</h1>')).toBe(
      "Tags & <braces>",
    );
  });

  it("takes the first h1 when a document has several", () => {
    expect(extractFirstHeading('<h1 id="a">First</h1><h1 id="b">Second</h1>')).toBe("First");
  });

  it("does not take a lower heading for the title", () => {
    // An h2 is a section of the page, not the page's name.
    expect(extractFirstHeading('<h2 id="a">Section</h2>')).toBeUndefined();
  });

  it("finds an h1 that sits below other headings", () => {
    expect(extractFirstHeading('<h2 id="a">Section</h2><h1 id="b">Title</h1>')).toBe("Title");
  });

  it("needs no id, unlike an outline entry", () => {
    // An outline entry must be linkable; a title is text, so an unanchored
    // heading still names the page.
    expect(extractFirstHeading("<h1>Plain</h1>")).toBe("Plain");
  });

  it("ignores an empty h1", () => {
    expect(extractFirstHeading('<h1 id="x"></h1><h1 id="y">Real</h1>')).toBe("Real");
  });

  it("returns nothing when the document names itself nowhere", () => {
    expect(extractFirstHeading("<p>Just prose.</p>")).toBeUndefined();
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
