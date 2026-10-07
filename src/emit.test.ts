import { describe, expect, it } from "vitest";
import { build } from "./index.js";
import { emitSite } from "./emit.js";
import { BASE_CSS } from "./styles.js";
import { CANOPY_TOKENS } from "./tokens.js";

describe("emitSite", () => {
  it("emits one HTML file per page plus the token and layout stylesheets", async () => {
    const bundle = await build({
      documents: [
        { path: "index.md", content: "# Home" },
        { path: "notes/idea.md", content: "# Idea" },
      ],
    });
    const files = emitSite(bundle);
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual([
      "index.html",
      "notes/idea.html",
      "styles.css",
      "tokens.css",
    ]);
  });

  it("emits complete HTML documents linking tokens before layout", async () => {
    const bundle = await build({ documents: [{ path: "index.md", content: "# Home" }] });
    const index = emitSite(bundle).find((f) => f.path === "index.html");
    expect(index?.contents).toMatch(/^<!doctype html>/);
    const tokensAt = index?.contents.indexOf("tokens.css") ?? -1;
    const stylesAt = index?.contents.indexOf("styles.css") ?? -1;
    expect(tokensAt).toBeGreaterThan(-1);
    expect(tokensAt).toBeLessThan(stylesAt); // tokens load first
  });

  it("puts canopy's own token and layout stylesheets in the canopy cascade layer", async () => {
    const bundle = await build({ documents: [{ path: "index.md", content: "# Home" }] });
    const files = emitSite(bundle);
    expect(files.find((f) => f.path === "tokens.css")?.contents).toBe(
      `@layer canopy {\n${CANOPY_TOKENS}\n}\n`,
    );
    expect(files.find((f) => f.path === "styles.css")?.contents).toBe(
      `@layer canopy {\n${BASE_CSS}\n}\n`,
    );
  });

  it("writes caller stylesheets as they are, linked after canopy's own, in order", async () => {
    const bundle = await build({ documents: [{ path: "index.md", content: "# Home" }] });
    const files = emitSite(bundle, { styles: [":root { --accent: #0a7c5a; }", ".x { color: red; }"] });
    // Unlayered on purpose: that is what lets them win over canopy's layer.
    expect(files.find((f) => f.path === "assets/stylesheet-1.css")?.contents).toBe(
      ":root { --accent: #0a7c5a; }",
    );
    expect(files.find((f) => f.path === "assets/stylesheet-2.css")?.contents).toBe(".x { color: red; }");
    const index = files.find((f) => f.path === "index.html")?.contents ?? "";
    const order = ["tokens.css", "styles.css", "assets/stylesheet-1.css", "assets/stylesheet-2.css"].map(
      (sheet) => index.indexOf(`href="${sheet}"`),
    );
    expect(order.every((at) => at > -1)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("writes no caller stylesheet when none is given", async () => {
    const bundle = await build({ documents: [{ path: "index.md", content: "# Home" }] });
    const paths = emitSite(bundle).map((f) => f.path);
    expect(paths.some((p) => p.startsWith("assets/stylesheet-"))).toBe(false);
  });

  it("links the site's own stylesheets last, after carried ones, at their own paths", async () => {
    const bundle = await build({ documents: [{ path: "guide/page.md", content: "# Page" }] });
    const files = emitSite(bundle, { styles: ["a {}"], siteStylesheets: ["theme/brand.css"] });
    // Published by the caller's asset copy, not written here: only linked.
    expect(files.some((f) => f.path === "theme/brand.css")).toBe(false);
    const page = files.find((f) => f.path === "guide/page.html")?.contents ?? "";
    expect(page).toContain('href="../theme/brand.css"');
    expect(page.indexOf('href="../assets/stylesheet-1.css"')).toBeLessThan(
      page.indexOf('href="../theme/brand.css"'),
    );
  });

  it("links caller stylesheets after any extra canopy stylesheet the caller listed", async () => {
    const bundle = await build({ documents: [{ path: "index.md", content: "# Home" }] });
    const index =
      emitSite(bundle, {
        stylesheets: ["tokens.css", "styles.css", "assets/katex.css"],
        styles: ["a {}"],
      }).find((f) => f.path === "index.html")?.contents ?? "";
    expect(index.indexOf('href="assets/katex.css"')).toBeLessThan(
      index.indexOf('href="assets/stylesheet-1.css"'),
    );
  });

  it("includes extra stylesheets passed by the consumer", async () => {
    const bundle = await build({ documents: [{ path: "index.md", content: "# Home" }] });
    const files = emitSite(bundle, {
      stylesheets: ["tokens.css", "styles.css", "assets/katex.css"],
    });
    const index = files.find((f) => f.path === "index.html");
    expect(index?.contents).toContain('href="assets/katex.css"');
  });

  it("synthesizes a root contents index when the tree has no index.md", async () => {
    const bundle = await build({
      documents: [
        { path: "Welcome.md", content: "# Welcome" },
        { path: "notes/idea.md", content: "# Idea" },
      ],
    });
    const files = emitSite(bundle);
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual([
      "Welcome.html",
      "index.html",
      "notes/idea.html",
      "styles.css",
      "tokens.css",
    ]);
    const index = files.find((f) => f.path === "index.html");
    expect(index?.contents).toContain("<h1>Contents</h1>");
    expect(index?.contents).toContain('href="Welcome.html"');
  });

  it("keeps the author's index.md as the root page instead of synthesizing", async () => {
    const bundle = await build({
      documents: [{ path: "index.md", content: "# My Home" }],
    });
    const roots = emitSite(bundle).filter((f) => f.path === "index.html");
    expect(roots).toHaveLength(1);
    expect(roots[0]?.contents).toContain("My Home");
    expect(roots[0]?.contents).not.toContain('class="canopy-contents"');
  });

  it("writes a search index file when a path is given", async () => {
    const bundle = await build({
      documents: [{ path: "index.md", content: "# Home\n\n## Section\n\ntext\n\n## Two\n\ntext" }],
    });
    const files = emitSite(bundle, { searchIndexPath: "search-index.json" });
    const indexFile = files.find((f) => f.path === "search-index.json");
    expect(indexFile).toBeDefined();
    expect(JSON.parse(indexFile?.contents ?? "[]")).toEqual([
      { p: "index.html", t: "Home", h: ["Section", "Two"], b: expect.any(String) },
    ]);
  });

  it("omits the search index file entirely when no path is given", async () => {
    const bundle = await build({ documents: [{ path: "index.md", content: "# Home" }] });
    const files = emitSite(bundle);
    expect(files.find((f) => f.path.endsWith("search-index.json"))).toBeUndefined();
  });

  it("gives the shell a search form when a search index is requested", async () => {
    const bundle = await build({ documents: [{ path: "index.md", content: "# Home" }] });
    const files = emitSite(bundle, { searchIndexPath: "search-index.json" });
    const page = files.find((f) => f.path === "index.html");
    expect(page?.contents).toContain('class="canopy-search"');
  });

  it("omits the search form when no search index is requested", async () => {
    const bundle = await build({ documents: [{ path: "index.md", content: "# Home" }] });
    const files = emitSite(bundle);
    const page = files.find((f) => f.path === "index.html");
    expect(page?.contents).not.toContain("canopy-search");
  });

  it("writes a caller-supplied script into assets/ and links it from every page", async () => {
    const bundle = await build({
      documents: [
        { path: "index.md", content: "# Home" },
        { path: "guide.md", content: "# Guide" },
      ],
    });
    const files = emitSite(bundle, { script: "console.log('hi');" });
    const asset = files.find((f) => f.path === "assets/script.js");
    expect(asset?.contents).toBe("console.log('hi');");
    for (const path of ["index.html", "guide.html"]) {
      const page = files.find((f) => f.path === path);
      expect(page?.contents).toContain("<script defer src=");
      expect(page?.contents).toContain("assets/script.js");
    }
  });

  it("writes no script asset and links nothing when none is given", async () => {
    const bundle = await build({ documents: [{ path: "index.md", content: "# Home" }] });
    const files = emitSite(bundle);
    expect(files.find((f) => f.path === "assets/script.js")).toBeUndefined();
    expect(files.find((f) => f.path === "index.html")?.contents).not.toContain("<script");
  });

  it("emits a valid contents index for an empty tree", async () => {
    const bundle = await build({ documents: [] });
    const index = emitSite(bundle).find((f) => f.path === "index.html");
    expect(index?.contents).toMatch(/^<!doctype html>/);
  });

  it("does not synthesize over a root index page that differs only by case", async () => {
    const bundle = await build({
      documents: [{ path: "Index.md", content: "# My Real Home" }],
    });
    const files = emitSite(bundle);
    const indexish = files.filter((f) => f.path.toLowerCase() === "index.html");
    expect(indexish).toHaveLength(1);
    expect(indexish[0]?.contents).toContain("My Real Home");
    expect(indexish[0]?.contents).not.toContain("<h1>Contents</h1>");
  });

  // renderPage only knows other pages' dates when emitSite hands it the whole
  // site — this is the wiring a listing depends on, end to end from markdown.
  it("gives a listing each entry's date and summary from the built pages", async () => {
    const bundle = await build({
      documents: [
        { path: "log/index.md", content: "---\nlisting: true\n---\n# Changes\n" },
        { path: "log/a.md", content: "---\ndate: 2026-10-03\ndescription: Feeds\n---\n# Feeds arrive\n" },
      ],
    });
    const index = emitSite(bundle).find((file) => file.path === "log/index.html")?.contents ?? "";
    expect(index).toContain('<a class="canopy-listing-title" href="a.html">Feeds arrive</a>');
    expect(index).toContain('<time datetime="2026-10-03">');
    expect(index).toContain("<p>Feeds</p>");
  });

  it("writes a stream's later listing pages, each titled with where it is", async () => {
    const layout = { dirs: { blog: { profile: "stream" as const, pageSize: 2 } } };
    const documents = ["a", "b", "c", "d", "e"].map((name, i) => ({
      path: `blog/${name}.md`,
      content: `---\ndate: 2026-10-0${i + 1}\n---\n# ${name.toUpperCase()}\n`,
    }));
    const files = emitSite(await build({ documents, layout }), { layout, siteTitle: "Site" });
    const paths = files.map((file) => file.path);
    expect(paths).toContain("blog/index.html");
    expect(paths).toContain("blog/page/2.html");
    expect(paths).toContain("blog/page/3.html");
    expect(paths).not.toContain("blog/page/4.html");
    const third = files.find((file) => file.path === "blog/page/3.html")?.contents ?? "";
    expect(third).toContain("<title>blog · Page 3 of 3 · Site</title>");
    expect(third).toContain('<a class="canopy-listing-title" href="../a.html">A</a>');
    expect(third).toContain('<a rel="prev" href="2.html">Newer posts</a><span>Page 3 of 3</span></nav>');
  });

  it("writes a stream's list of tags and a page for each tag, listing only its posts", async () => {
    const layout = { dirs: { blog: { profile: "stream" as const, title: "Blog" } } };
    const documents = [
      { path: "blog/a.md", content: "---\ndate: 2026-10-01\ntags: [Design]\n---\n# A\n" },
      { path: "blog/b.md", content: "---\ndate: 2026-10-02\ntags: [design, Notes]\n---\n# B\n" },
      { path: "blog/c.md", content: "---\ndate: 2026-10-03\n---\n# C\n" },
    ];
    const files = emitSite(await build({ documents, layout }), { layout, siteTitle: "Site" });
    const at = (path: string) => files.find((file) => file.path === path)?.contents ?? "";
    expect(at("blog/tags/index.html")).toContain("<title>Tags · Blog · Site</title>");
    expect(at("blog/tags/index.html")).toContain(
      '<ul class="canopy-tags canopy-tag-index"><li><a href="design.html">design</a> <span class="canopy-tag-count">2</span></li>' +
        '<li><a href="notes.html">Notes</a> <span class="canopy-tag-count">1</span></li></ul>',
    );
    const design = at("blog/tags/design.html");
    expect(design).toContain("<title>design · Blog · Site</title>");
    expect(design).toContain('<a class="canopy-listing-title" href="../b.html">B</a>');
    expect(design).toContain('<a class="canopy-listing-title" href="../a.html">A</a>');
    expect(design).not.toContain('href="../c.html"');
    expect(design).not.toContain("canopy-byline");
  });

  it("continues a tag's page on later pages once its posts outnumber pageSize", async () => {
    const layout = { dirs: { blog: { profile: "stream" as const, title: "Blog", pageSize: 2 } } };
    const documents = ["a", "b", "c", "d", "e"].map((name, i) => ({
      path: `blog/${name}.md`,
      content: `---
date: 2026-10-0${i + 1}
tags: [Design]
---
# ${name.toUpperCase()}
`,
    }));
    const files = emitSite(await build({ documents, layout }), { layout, siteTitle: "Site" });
    const at = (path: string) => files.find((file) => file.path === path)?.contents ?? "";
    const paths = files.map((file) => file.path);
    expect(paths).toContain("blog/tags/design/page/2.html");
    expect(paths).toContain("blog/tags/design/page/3.html");
    expect(paths).not.toContain("blog/tags/design/page/4.html");

    const first = at("blog/tags/design.html");
    expect(first).toContain('<a class="canopy-listing-title" href="../e.html">E</a>');
    expect(first).toContain('<a class="canopy-listing-title" href="../d.html">D</a>');
    expect(first).not.toContain('href="../c.html"');
    expect(first).toContain(
      '<nav class="canopy-pagination" aria-label="Page navigation">' +
        '<span>Page 1 of 3</span><a rel="next" href="design/page/2.html">Older posts</a></nav>',
    );
    expect(first).toContain('<p class="canopy-tag-index-link"><a href="index.html">Tags</a></p>');

    const second = at("blog/tags/design/page/2.html");
    expect(second).toContain("<title>Design · Page 2 of 3 · Blog · Site</title>");
    expect(second).toContain("<h1>Design</h1>");
    expect(second).toContain('<a class="canopy-listing-title" href="../../../c.html">C</a>');
    expect(second).toContain('<a class="canopy-listing-title" href="../../../b.html">B</a>');
    expect(second).not.toContain('href="../../../a.html"');
    expect(second).toContain(
      '<a rel="prev" href="../../design.html">Newer posts</a><span>Page 2 of 3</span>' +
        '<a rel="next" href="3.html">Older posts</a></nav>',
    );
    // A later page continues the tag's list; the way to every tag is on its first.
    expect(second).not.toContain("canopy-tag-index-link");
    // A post's tag still leads to the tag's first page.
    expect(second).toContain('<ul class="canopy-tags" aria-label="Tags"><li><a href="../../design.html">Design</a></li></ul>');
  });
});
