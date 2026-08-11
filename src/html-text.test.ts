import { describe, expect, it } from "vitest";
import { htmlToText } from "./html-text.js";

describe("htmlToText", () => {
  it("strips inline tags without adding a space", () => {
    expect(htmlToText("Some <strong>bold</strong> and a <code>span</code>.")).toBe(
      "Some bold and a span.",
    );
  });

  it("separates adjacent table cells with a space", () => {
    expect(htmlToText("<table><tr><td>가리킴</td><td>안 가리킴</td></tr></table>")).toBe(
      "가리킴 안 가리킴",
    );
  });

  it("separates table rows with a space", () => {
    const html = "<table><tr><td>a</td></tr><tr><td>b</td></tr></table>";
    expect(htmlToText(html)).toBe("a b");
  });

  it("separates list items with a space", () => {
    expect(htmlToText("<ul><li>first</li><li>second</li></ul>")).toBe("first second");
  });

  it("separates paragraphs and headings with a space", () => {
    expect(htmlToText("<h2>Title</h2><p>First.</p><p>Second.</p>")).toBe("Title First. Second.");
  });

  it("treats <br> as a boundary", () => {
    expect(htmlToText("Line one<br>Line two")).toBe("Line one Line two");
  });

  it("collapses a boundary next to existing whitespace into one space", () => {
    expect(htmlToText("<p>First. </p>\n<p> Second.</p>")).toBe("First. Second.");
  });

  it("decodes entities after boundaries are resolved", () => {
    expect(htmlToText("<td>a &amp; b</td><td>c</td>")).toBe("a & b c");
  });

  it("decodes numeric character references, decimal and hex alike", () => {
    // rehype-stringify escapes `<` inside inline code as &#x3C;, not &lt; —
    // a real page hitting this: reference/settings.md's `<meta name="...">`
    // written as inline code came out as "&#x3C;meta ...>" before this.
    expect(htmlToText("&#x3C;meta&#x3E;")).toBe("<meta>");
    expect(htmlToText("&#60;meta&#62;")).toBe("<meta>");
  });
});
