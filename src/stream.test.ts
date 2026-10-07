import { describe, expect, it } from "vitest";
import type { RenderedPage } from "./contract.js";
import { build } from "./index.js";
import { streamOrder } from "./stream.js";

const dated = (sitePath: string, date: unknown): RenderedPage => ({
  sourcePath: "",
  sitePath,
  frontmatter: date === undefined ? {} : { date },
  html: "",
  backlinks: [],
  outline: [],
});

describe("streamOrder", () => {
  it("dates a page named by its day as if it said so in its frontmatter", () => {
    const named = { ...dated("b/2026-02-01-feb.html", undefined), sourcePath: "b/2026-02-01-feb.md" };
    const pages = [dated("b/jan.html", "2026-01-01"), named, dated("b/mar.html", "2026-03-01")];
    expect(pages.sort(streamOrder).map((page) => page.sitePath)).toEqual([
      "b/mar.html",
      "b/2026-02-01-feb.html",
      "b/jan.html",
    ]);
  });

  it("puts the newest day first, then the later time that day, then undated pages by path", () => {
    const pages = [
      dated("b/undated.html", undefined),
      dated("b/jan.html", "2026-01-01"),
      dated("b/mar-morning.html", "2026-03-01T09:00:00+09:00"),
      dated("b/mar.html", "2026-03-01"),
      dated("a/undated.html", undefined),
      dated("b/bad.html", "someday"),
    ];
    expect(pages.sort(streamOrder).map((page) => page.sitePath)).toEqual([
      "b/mar-morning.html",
      "b/mar.html",
      "b/jan.html",
      "a/undated.html",
      "b/bad.html",
      "b/undated.html",
    ]);
  });
});

describe("a build with stream folders", () => {
  it("lists a stream folder newest first under its index, flattening subfolders", async () => {
    const bundle = await build({
      documents: [
        { path: "blog/index.md", content: "# Blog\n" },
        { path: "blog/a-old.md", content: "---\ndate: 2026-01-01\n---\n# Old\n" },
        { path: "blog/b-new.md", content: "---\ndate: 2026-03-01\n---\n# New\n" },
        { path: "blog/c-undated.md", content: "# Undated\n" },
        { path: "blog/2025/d-mid.md", content: "---\ndate: 2026-02-01\n---\n# Mid\n" },
        { path: "guide/z.md", content: "# Z\n" },
        { path: "guide/a.md", content: "# A\n" },
      ],
      layout: { dirs: { blog: { profile: "stream" } } },
    });
    const blog = bundle.navigation.find((node) => node.sitePath === "blog/index.html");
    expect(blog?.children.map((node) => [node.sitePath, node.children.length])).toEqual([
      ["blog/b-new.html", 0],
      ["blog/2025/d-mid.html", 0],
      ["blog/a-old.html", 0],
      ["blog/c-undated.html", 0],
    ]);
    const guide = bundle.navigation.find((node) => node.label === "guide");
    expect(guide?.children.map((node) => node.label)).toEqual(["A", "Z"]);
  });

  it("writes an index page for a stream folder that has none, which links can reach", async () => {
    const bundle = await build({
      documents: [
        { path: "news/a.md", content: "---\ndate: 2026-01-01\n---\n# A\n" },
        { path: "news/b.md", content: "# B\n\nBack to [[news/index]].\n" },
      ],
      layout: { dirs: { news: { profile: "stream", title: "News" } } },
    });
    const index = bundle.pages.find((page) => page.sitePath === "news/index.html");
    expect(index).toMatchObject({ sourcePath: "", frontmatter: { title: "News" }, html: "<h1>News</h1>" });
    expect(index?.backlinks.map((link) => link.sitePath)).toEqual(["news/b.html"]);
    expect(bundle.pages.find((page) => page.sitePath === "news/b.html")?.html).toContain('href="index.html"');
    const news = bundle.navigation.find((node) => node.sitePath === "news/index.html");
    expect(news?.label).toBe("News");
    expect(news?.children.map((node) => node.sitePath)).toEqual(["news/a.html", "news/b.html"]);
  });

  it("names a written index after its folder when the layout gives no title", async () => {
    const bundle = await build({
      documents: [{ path: "notes/a.md", content: "# A\n" }],
      layout: { dirs: { notes: { profile: "stream" } } },
    });
    expect(bundle.pages.find((page) => page.sitePath === "notes/index.html")?.frontmatter).toEqual({
      title: "notes",
    });
  });

  it("makes the whole site one stream when the default is stream", async () => {
    const bundle = await build({
      documents: [
        { path: "index.md", content: "# Home\n" },
        { path: "x.md", content: "---\ndate: 2026-01-01\n---\n# X\n" },
        { path: "y/z.md", content: "---\ndate: 2026-05-01\n---\n# Z\n" },
      ],
      layout: { default: { profile: "stream" } },
    });
    expect(bundle.navigation.map((node) => node.sitePath)).toEqual(["index.html", "y/z.html", "x.html"]);
  });

  it("keeps the labels a navigation spec gave while it reorders", async () => {
    const bundle = await build({
      documents: [
        { path: "blog/index.md", content: "# Blog\n" },
        { path: "blog/a.md", content: "---\ndate: 2026-01-01\n---\n# A\n" },
        { path: "blog/b.md", content: "---\ndate: 2026-02-01\n---\n# B\n" },
      ],
      nav: { items: [{ path: "blog/index", items: [{ path: "blog/a", label: "Alpha" }], derive: "blog" }] },
      layout: { dirs: { blog: { profile: "stream" } } },
    });
    expect(bundle.navigation[0]?.children.map((node) => node.label)).toEqual(["B", "Alpha"]);
  });

  // A subfolder of a stream is not a second level of the list: its own index is
  // one more post, and what was under it moves up beside it.
  it("makes a subfolder's index page one post of the stream, its pages beside it", async () => {
    const bundle = await build({
      documents: [
        { path: "blog/index.md", content: "# Blog\n" },
        { path: "blog/series/index.md", content: "---\ndate: 2026-02-01\n---\n# Series\n" },
        { path: "blog/series/part-1.md", content: "---\ndate: 2026-03-01\n---\n# Part 1\n" },
        { path: "blog/a.md", content: "---\ndate: 2026-01-01\n---\n# A\n" },
      ],
      layout: { dirs: { blog: { profile: "stream" } } },
    });
    const blog = bundle.navigation.find((node) => node.sitePath === "blog/index.html");
    expect(blog?.children.map((node) => [node.sitePath, node.children.length])).toEqual([
      ["blog/series/part-1.html", 0],
      ["blog/series/index.html", 0],
      ["blog/a.html", 0],
    ]);
  });

  // A folder inside a stream with a profile of its own is its own matter: a
  // manual folder keeps its tree, a stream folder is listed under its own index.
  it("leaves a subfolder with its own profile out of the enclosing stream", async () => {
    const bundle = await build({
      documents: [
        { path: "blog/index.md", content: "# Blog\n" },
        { path: "blog/a.md", content: "---\ndate: 2026-01-01\n---\n# A\n" },
        { path: "blog/archive/index.md", content: "# Archive\n" },
        { path: "blog/archive/z.md", content: "# Z\n" },
        { path: "blog/archive/y.md", content: "# Y\n" },
        { path: "blog/news/index.md", content: "# News\n" },
        { path: "blog/news/old.md", content: "---\ndate: 2025-01-01\n---\n# Old\n" },
        { path: "blog/news/new.md", content: "---\ndate: 2025-06-01\n---\n# New\n" },
      ],
      layout: { dirs: { blog: { profile: "stream" }, "blog/archive": { profile: "manual" }, "blog/news": { profile: "stream" } } },
    });
    const blog = bundle.navigation.find((node) => node.sitePath === "blog/index.html");
    expect(blog?.children.map((node) => node.sitePath)).toEqual(["blog/a.html", "blog/archive/index.html", "blog/news/index.html"]);
    const archive = blog?.children.find((node) => node.sitePath === "blog/archive/index.html");
    expect(archive?.children.map((node) => node.label)).toEqual(["Y", "Z"]);
    const news = blog?.children.find((node) => node.sitePath === "blog/news/index.html");
    expect(news?.children.map((node) => node.label)).toEqual(["New", "Old"]);
  });

  it("leaves the tree as a navigation spec made it when the spec leaves out the stream's index", async () => {
    const bundle = await build({
      documents: [
        { path: "blog/index.md", content: "# Blog\n" },
        { path: "blog/a.md", content: "---\ndate: 2026-01-01\n---\n# A\n" },
        { path: "blog/b.md", content: "---\ndate: 2026-02-01\n---\n# B\n" },
      ],
      nav: { items: [{ path: "blog/a" }, { path: "blog/b" }] },
      layout: { dirs: { blog: { profile: "stream" } } },
    });
    expect(bundle.navigation.map((node) => node.sitePath)).toEqual(["blog/a.html", "blog/b.html"]);
  });

  it("leaves a build with no layout exactly as it was", async () => {
    const documents = [
      { path: "blog/b.md", content: "---\ndate: 2026-03-01\n---\n# B\n" },
      { path: "blog/a.md", content: "---\ndate: 2026-01-01\n---\n# A\n" },
    ];
    const bundle = await build({ documents });
    expect(bundle.navigation[0]?.children.map((node) => node.label)).toEqual(["A", "B"]);
    expect(bundle.pages).toHaveLength(2);
  });
});
