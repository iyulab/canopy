import { describe, expect, it } from "vitest";
import type { RenderedPage } from "./contract.js";
import {
  FragmentError,
  fragmentHref,
  fragmentLinks,
  fragmentProblems,
  pageSlotKeys,
  pageSlotProblems,
  pageSlotText,
  renderFragment,
} from "./regions.js";

describe("fragmentProblems", () => {
  it("accepts every control slot and a page slot with fallback content", () => {
    const html =
      '<header><canopy-slot name="site-title"></canopy-slot><canopy-slot name="home"></canopy-slot>' +
      '<canopy-slot name="back"></canopy-slot><canopy-slot name="breadcrumb"></canopy-slot>' +
      '<canopy-slot name="language"></canopy-slot><canopy-slot name="search"></canopy-slot>' +
      '<canopy-slot name="theme-toggle"></canopy-slot>' +
      '<p><canopy-slot name="page:cta">Read more</canopy-slot></p></header>';
    expect(fragmentProblems(html, "header")).toEqual([]);
  });

  it("names an unknown slot and the slots there are", () => {
    expect(fragmentProblems('<canopy-slot name="sidebar"></canopy-slot>', "header")).toEqual([
      'unknown slot "sidebar" — slots are site-title, home, back, breadcrumb, language, search, ' +
        "theme-toggle, or page:<frontmatter key>",
    ]);
  });

  // HTML does not close a custom element on "/>", so everything after it ends
  // up inside the slot — and would vanish when the slot is replaced.
  it("explains a self-closing control slot that took in what follows", () => {
    expect(
      fragmentProblems('<nav><canopy-slot name="search"/><a href="x.html">X</a></nav>', "header"),
    ).toEqual([
      '<canopy-slot name="search"> must be empty — write it as <canopy-slot name="search"></canopy-slot>; ' +
        "HTML does not close a self-closing custom tag, so it takes in what follows",
    ]);
  });

  it("refuses any slot in the head region", () => {
    expect(fragmentProblems('<canopy-slot name="page:title"></canopy-slot>', "head")).toEqual([
      '<canopy-slot name="page:title"> cannot sit in the head region — nothing there is shown to a reader, ' +
        "and text inside <script> or <title> is not HTML a slot could become",
    ]);
  });

  it("refuses a nameless slot, an empty page key, and a slot inside a slot", () => {
    const html =
      '<canopy-slot></canopy-slot><canopy-slot name="page:"></canopy-slot>' +
      '<canopy-slot name="page:cta"><canopy-slot name="home"></canopy-slot></canopy-slot>';
    expect(fragmentProblems(html, "footer")).toEqual([
      "<canopy-slot> needs a name",
      '<canopy-slot name="page:"> needs a frontmatter key after "page:"',
      '<canopy-slot name="home"> sits inside another slot — slots do not nest',
    ]);
  });
});

describe("pageSlotKeys and fragmentLinks", () => {
  it("lists each page key once, in order", () => {
    const html =
      '<p><canopy-slot name="page:cta">x</canopy-slot><canopy-slot name="page:cta"></canopy-slot>' +
      '<canopy-slot name="page:author"></canopy-slot><canopy-slot name="home"></canopy-slot></p>';
    expect(pageSlotKeys(html)).toEqual(["cta", "author"]);
  });

  it("lists every href and src, in order", () => {
    const html =
      '<a href="blog/">B</a><img src="img/x.png" alt=""><link rel="stylesheet" href="host.css"><a>none</a>';
    expect(fragmentLinks(html)).toEqual(["blog/", "img/x.png", "host.css"]);
  });
});

describe("fragmentHref", () => {
  it.each([
    ["blog/a.html", "blog/b.html", "b.html"],
    ["blog/2026/a.html", "assets/x.png", "../../assets/x.png"],
    ["blog/a.html", "blog/", "./"],
    ["blog/a.html", "guide/", "../guide/"],
    ["index.html", "blog/", "blog/"],
    ["blog/a.html", "index.html#top", "../index.html#top"],
    ["blog/a.html", "./guide/x.html", "../guide/x.html"],
    ["blog/a.html", "deep%20dive.html", "../deep%20dive.html"],
    ["blog/a.html", "/pricing", "/pricing"],
    ["blog/a.html", "//cdn.example.com/x.css", "//cdn.example.com/x.css"],
    ["blog/a.html", "https://example.com/x", "https://example.com/x"],
    ["blog/a.html", "#cta", "#cta"],
    ["blog/a.html", "mailto:team@example.com", "mailto:team@example.com"],
  ])("from %s, %s becomes %s", (from, url, expected) => {
    expect(fragmentHref(from, url)).toBe(expected);
  });
});

describe("renderFragment", () => {
  const context = {
    from: "blog/post.html",
    control: (name: string) => (name === "search" ? '<form class="canopy-search"></form>' : ""),
    page: (key: string) => (key === "cta" ? "Try it <free>" : undefined),
  };

  it("replaces control slots with canopy's markup, drops inactive ones, and rewrites links", () => {
    expect(
      renderFragment(
        '<header><a href="index.html">Home</a><canopy-slot name="search"></canopy-slot>' +
          '<canopy-slot name="language"></canopy-slot></header>',
        context,
      ),
    ).toBe('<header><a href="../index.html">Home</a><form class="canopy-search"></form></header>');
  });

  it("fills a page slot with the page's text, escaped, or else with its fallback", () => {
    const html = renderFragment(
      '<p><canopy-slot name="page:cta">Default</canopy-slot></p>' +
        '<p><canopy-slot name="page:other">See <a href="blog/">all</a></canopy-slot></p>',
      context,
    );
    expect(html).not.toContain("<free>");
    expect(html).toContain("<p>Try it &#x3C;free");
    expect(html).toContain('<p>See <a href="./">all</a></p>');
  });

  it("keeps head markup intact", () => {
    expect(
      renderFragment('<link rel="stylesheet" href="host.css"><script>window.x = 1 < 2;</script>', context),
    ).toBe('<link rel="stylesheet" href="../host.css"><script>window.x = 1 < 2;</script>');
  });

  it("throws on a slot it does not know", () => {
    expect(() => renderFragment('<canopy-slot name="nav"></canopy-slot>', context)).toThrow(FragmentError);
  });
});

describe("pageSlotText", () => {
  it("reads a frontmatter string, and treats an absent or blank one as unset", () => {
    expect(pageSlotText({ cta: "Download" }, "cta")).toBe("Download");
    expect(pageSlotText({ cta: "  " }, "cta")).toBeUndefined();
    expect(pageSlotText({ cta: null }, "cta")).toBeUndefined();
    expect(pageSlotText({}, "cta")).toBeUndefined();
  });

  it.each([
    [["a", "b"], "a list"],
    [3, "a number"],
    [new Date("2026-01-01"), "a date"],
    [{ a: 1 }, "an object"],
  ])("refuses %j, naming it as %s", (value, kind) => {
    expect(() => pageSlotText({ cta: value }, "cta")).toThrow(
      `frontmatter "cta" must be text to fill <canopy-slot name="page:cta">, not ${kind}`,
    );
  });
});

describe("pageSlotProblems", () => {
  const page = (sitePath: string, frontmatter: Record<string, unknown>): RenderedPage => ({
    sourcePath: sitePath.replace(/\.html$/, ".md"),
    sitePath,
    frontmatter,
    html: "",
    backlinks: [],
    outline: [],
  });

  it("checks only the pages a fragment with that key reaches", () => {
    const layout = { dirs: { blog: { regions: { afterArticle: "cta.html" } } } };
    const fragments = { "cta.html": '<canopy-slot name="page:cta">Default</canopy-slot>' };
    expect(
      pageSlotProblems(
        [page("blog/a.html", { cta: ["x"] }), page("guide/b.html", { cta: ["x"] }), page("blog/c.html", {})],
        layout,
        fragments,
      ),
    ).toEqual(['blog/a.md: frontmatter "cta" must be text to fill <canopy-slot name="page:cta">, not a list']);
  });
});
