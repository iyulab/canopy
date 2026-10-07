import { describe, expect, it } from "vitest";
import type { RenderedPage } from "./contract.js";
import { buildLinkIndex } from "./links.js";
import { pickReadNext, readNextProblems, readNextValues, relatedPosts, resolveReadNext } from "./read-next.js";

function page(sitePath: string, frontmatter: Record<string, unknown> = {}, linkedFrom: string[] = []): RenderedPage {
  return {
    sourcePath: sitePath.replace(/\.html$/, ".md"),
    sitePath,
    frontmatter,
    html: "",
    backlinks: linkedFrom.map((from) => ({ sitePath: from, title: undefined })),
    outline: [],
  };
}

const layout = { dirs: { blog: { profile: "stream" as const } } };

describe("readNextValues", () => {
  it("reads a list or one string, trimmed, empty ones dropped", () => {
    expect(readNextValues({ readNext: [" a.md ", "", 3, "[[b]]"] })).toEqual(["a.md", "[[b]]"]);
    expect(readNextValues({ readNext: "a.md" })).toEqual(["a.md"]);
    expect(readNextValues({})).toEqual([]);
  });
});

describe("resolveReadNext", () => {
  const index = buildLinkIndex(["guide/install.html", "guide/Setup.html", "blog/index.html", "notes/idea.html"]);

  it("resolves a path like a markdown link written on the page, in the build's spelling", () => {
    expect(resolveReadNext("guide/install.html", "setup.md", index)).toBe("guide/Setup.html");
    expect(resolveReadNext("guide/install.html", "../notes/idea", index)).toBe("notes/idea.html");
    expect(resolveReadNext("guide/install.html", "../blog/", index)).toBe("blog/index.html");
  });

  it("resolves a wikilink as one in the text does, heading and alias aside", () => {
    expect(resolveReadNext("blog/a.html", "[[idea#why|Why]]", index)).toBe("notes/idea.html");
  });

  it("names nothing for a missing page, an asset, an outside URL or an empty wikilink", () => {
    expect(resolveReadNext("guide/install.html", "gone.md", index)).toBeUndefined();
    expect(resolveReadNext("guide/install.html", "diagram.png", index)).toBeUndefined();
    expect(resolveReadNext("guide/install.html", "https://example.com/", index)).toBeUndefined();
    expect(resolveReadNext("guide/install.html", "[[]]", index)).toBeUndefined();
  });

  it("reports every value that names no page, by the page that wrote it", () => {
    const pages = [page("guide/install.html", { readNext: ["setup.md", "gone.md"] })];
    expect(readNextProblems(pages, index)).toEqual([
      { sitePath: "guide/install.html", message: 'readNext "gone.md" names no page of this site' },
    ]);
  });
});

describe("relatedPosts", () => {
  it("scores shared tags by how rare they are, adds a link either way, and keeps only what scores", () => {
    const posts = [
      page("blog/a.html", { date: "2026-10-05", tags: ["Rare", "Common"] }),
      page("blog/b.html", { date: "2026-10-04", tags: ["Rare", "Common"] }),
      page("blog/c.html", { date: "2026-10-03", tags: ["Common"] }, ["blog/a.html"]),
      page("blog/d.html", { date: "2026-10-02", tags: ["Common"] }),
    ];
    // "Common" is on every post, so it adds nothing; "Rare" ln(4/2); c is linked from a: 1.
    expect(relatedPosts(posts[0] as RenderedPage, posts)).toEqual(["blog/c.html", "blog/b.html"]);
  });

  it("breaks a tie by the nearer date, then by path", () => {
    const posts = [
      page("blog/mid.html", { date: "2026-10-10", tags: ["x"] }),
      page("blog/far.html", { date: "2026-10-01", tags: ["x"] }),
      page("blog/near.html", { date: "2026-10-12", tags: ["x"] }),
      page("blog/other.html", { date: "2026-10-11" }),
      page("blog/twin.html", { date: "2026-10-12", tags: ["x"] }),
    ];
    expect(relatedPosts(posts[0] as RenderedPage, posts)).toEqual(["blog/near.html", "blog/twin.html", "blog/far.html"]);
  });
});

describe("pickReadNext", () => {
  const posts = [
    page("blog/index.html"),
    page("blog/e.html", { date: "2026-10-05" }),
    page("blog/d.html", { date: "2026-10-04", tags: ["x"] }),
    page("blog/c.html", { date: "2026-10-03" }),
    page("blog/b.html", { date: "2026-10-02", tags: ["x"] }),
    page("blog/a.html", { date: "2026-10-01" }),
    page("guide/start.html"),
  ];
  const index = buildLinkIndex(posts.map((p) => p.sitePath));
  const at = (sitePath: string, frontmatter?: Record<string, unknown>) => {
    const base = posts.find((p) => p.sitePath === sitePath) as RenderedPage;
    return frontmatter === undefined ? base : { ...base, frontmatter: { ...base.frontmatter, ...frontmatter } };
  };

  it("fills a post's slots with related posts, then the newest, never itself", () => {
    expect(pickReadNext(at("blog/b.html"), posts, layout, index)).toEqual({
      sitePaths: ["blog/d.html", "blog/e.html", "blog/c.html"],
      chosen: false,
    });
  });

  it("puts the author's choice first, whole, and fills only what is left", () => {
    expect(pickReadNext(at("blog/b.html", { readNext: ["a.md", "../guide/start.md"] }), posts, layout, index)).toEqual({
      sitePaths: ["blog/a.html", "guide/start.html", "blog/d.html"],
      chosen: true,
    });
    const many = ["a.md", "c.md", "e.md", "../guide/start.md"];
    expect(pickReadNext(at("blog/b.html", { readNext: many }), posts, layout, index).sitePaths).toEqual([
      "blog/a.html",
      "blog/c.html",
      "blog/e.html",
      "guide/start.html",
    ]);
  });

  it("puts the stream's featured posts after the author's choice, as chosen, before related ones", () => {
    const featured = { dirs: { blog: { profile: "stream" as const, featured: ["blog/A.md", "blog/b.md"] } } };
    expect(pickReadNext(at("blog/b.html", { readNext: "c.md" }), posts, featured, index)).toEqual({
      sitePaths: ["blog/c.html", "blog/a.html", "blog/d.html"],
      chosen: true,
    });
  });

  it("gives a manual page only what its author named", () => {
    expect(pickReadNext(at("guide/start.html"), posts, layout, index)).toEqual({ sitePaths: [], chosen: false });
    expect(pickReadNext(at("guide/start.html", { readNext: "[[e]]" }), posts, layout, index)).toEqual({
      sitePaths: ["blog/e.html"],
      chosen: true,
    });
  });

  it("does not fill in the stream's own list", () => {
    expect(pickReadNext(at("blog/index.html"), posts, layout, index).sitePaths).toEqual([]);
  });
});
