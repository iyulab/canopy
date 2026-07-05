import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMath from "remark-math";
import type { Root } from "mdast";
import remarkMathSubset from "./remark-math-subset.js";

/** Parse markdown through remark-math + the subset plugin and return the mdast. */
function parse(markdown: string): Root {
  const processor = unified().use(remarkParse).use(remarkMath).use(remarkMathSubset);
  return processor.runSync(processor.parse(markdown), markdown) as Root;
}

/** Flatten the tree into `type:value` strings, depth-first, for terse shape assertions. */
function shape(node: unknown): string[] {
  const n = node as { type: string; value?: string; children?: unknown[] };
  const self = n.value === undefined ? n.type : `${n.type}:${n.value}`;
  return [self, ...(n.children ?? []).flatMap(shape)];
}

describe("remarkMathSubset — standalone $$..$$ promotion", () => {
  it("promotes a paragraph that is a single standalone $$..$$ line to display math", () => {
    expect(shape(parse("$$x+y$$"))).toEqual(["root", "math:x+y"]);
  });

  it("promotes between surrounding paragraphs", () => {
    const s = shape(parse("before\n\n$$x+y$$\n\nafter"));
    expect(s).toContain("math:x+y");
    expect(s.filter((t) => t === "paragraph")).toHaveLength(2);
  });

  it("promotes a paragraph of several standalone $$..$$ lines to one display block each", () => {
    expect(shape(parse("$$x$$\n$$y$$"))).toEqual(["root", "math:x", "math:y"]);
  });

  it("promotes inside a list item when the math is its own paragraph", () => {
    expect(shape(parse("- item\n\n  $$x$$"))).toContain("math:x");
  });

  it("keeps padded delimiters promotable ($$ x $$)", () => {
    expect(shape(parse("$$ x+y $$"))).toEqual(["root", "math:x+y"]);
  });

  it("does not promote $$..$$ mixed into a paragraph with text", () => {
    const s = shape(parse("text $$x+y$$ more"));
    expect(s).toContain("inlineMath:x+y");
    expect(s).not.toContain("math:x+y");
  });

  it("does not promote a $$..$$ line inside a multi-line paragraph", () => {
    const s = shape(parse("text\n$$x+y$$\nmore"));
    expect(s).toContain("inlineMath:x+y");
    expect(s).not.toContain("math:x+y");
  });

  it("does not promote inside a blockquote line (marker prefix, not standalone)", () => {
    const s = shape(parse("> $$x+y$$"));
    expect(s).toContain("inlineMath:x+y");
    expect(s).not.toContain("math:x+y");
  });

  it("does not promote single-dollar math on its own line", () => {
    expect(shape(parse("$x$"))).toEqual(["root", "paragraph", "inlineMath:x"]);
  });

  it("leaves fenced display math alone", () => {
    expect(shape(parse("$$\nx+y\n$$"))).toEqual(["root", "math:x+y"]);
  });
});

describe("remarkMathSubset — conservative single-$ guards", () => {
  it("demotes a span whose closing $ is preceded by whitespace (currency)", () => {
    expect(shape(parse("costs $5 and $10 total"))).toEqual([
      "root",
      "paragraph",
      "text:costs ",
      "text:$5 and $",
      "text:10 total",
    ]);
  });

  it("demotes a span whose opening $ is followed by whitespace", () => {
    const s = shape(parse("a $ x$ b"));
    expect(s).not.toContain("inlineMath: x");
    expect(s.join("|")).toContain("$ x$");
  });

  it("demotes a span whose closing $ is followed by a digit", () => {
    const s = shape(parse("a $x$5 b"));
    expect(s).not.toContain("inlineMath:x");
    expect(s.join("|")).toContain("$x$");
  });

  it("keeps a span whose closing $ is followed by a space then a digit", () => {
    expect(shape(parse("pay $x$ 5"))).toContain("inlineMath:x");
  });

  it("keeps ordinary inline math", () => {
    expect(shape(parse("Inline $E=mc^2$ here"))).toContain("inlineMath:E=mc^2");
  });

  it("keeps math after an even backslash run (\\\\$x$)", () => {
    expect(shape(parse("a \\\\$x$ b"))).toContain("inlineMath:x");
  });

  it("does not touch double-dollar spans (promotion's domain)", () => {
    expect(shape(parse("text $$ x $$ more"))).toContain("inlineMath:x");
  });

  it("applies guards inside nested containers", () => {
    const s = shape(parse("> costs $5 and $10 total"));
    expect(s).toContain("text:$5 and $");
  });
});
