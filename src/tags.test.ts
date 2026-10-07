import { describe, expect, it } from "vitest";
import type { RenderedPage } from "./contract.js";
import { pageTags, streamTagPaths, streamTags, tagIndexPath, tagPagePath, tagProblems, tagSlug } from "./tags.js";

function post(sitePath: string, date: string, tags: unknown): RenderedPage {
  return { sourcePath: sitePath.replace(/\.html$/, ".md"), sitePath, frontmatter: { date, tags }, html: "", backlinks: [], outline: [] };
}

describe("tagSlug", () => {
  it("lowercases, joins words with -, and keeps letters of any script", () => {
    expect(tagSlug("Release Notes")).toBe("release-notes");
    expect(tagSlug("  Node.js  ")).toBe("node.js");
    expect(tagSlug("한국어 문서")).toBe("한국어-문서");
  });

  it("turns characters that would break a path into -, then tidies the dashes", () => {
    expect(tagSlug("C/C++ ? #1 %done\\x")).toBe("c-c++-1-done-x");
    expect(tagSlug("--a--b--")).toBe("a-b");
    expect(tagSlug("/?#")).toBe("");
  });
});

describe("pageTags", () => {
  it("reads a list or a single string, trimmed, once per slug", () => {
    expect(pageTags({ tags: ["Design", " design ", "Notes"] })).toEqual(["Design", "Notes"]);
    expect(pageTags({ tags: "Design" })).toEqual(["Design"]);
    expect(pageTags({ tags: [1, "", " "] })).toEqual([]);
    expect(pageTags({})).toEqual([]);
  });
});

describe("streamTags", () => {
  it("gathers a stream's tags by slug, each with its posts newest first, sorted by slug", () => {
    const pages = [
      post("blog/c.html", "2026-10-03", ["Design"]),
      post("blog/b.html", "2026-10-02", ["design", "Notes"]),
      post("blog/a.html", "2026-10-01", ["DESIGN"]),
    ];
    expect(streamTags(pages)).toEqual([
      // Three spellings, once each: the tie goes to the newest post's.
      { slug: "design", name: "Design", posts: ["blog/c.html", "blog/b.html", "blog/a.html"] },
      { slug: "notes", name: "Notes", posts: ["blog/b.html"] },
    ]);
  });

  it("names a tag by the spelling most posts use", () => {
    const pages = [
      post("blog/c.html", "2026-10-03", ["design"]),
      post("blog/b.html", "2026-10-02", ["Design"]),
      post("blog/a.html", "2026-10-01", ["Design"]),
    ];
    expect(streamTags(pages)[0]?.name).toBe("Design");
  });
});

describe("tag paths", () => {
  const layout = { dirs: { blog: { profile: "stream" as const } } };

  it("puts a stream's tags under its folder", () => {
    expect(tagIndexPath("blog")).toBe("blog/tags/index.html");
    expect(tagIndexPath("")).toBe("tags/index.html");
    expect(tagPagePath("blog", "release-notes")).toBe("blog/tags/release-notes.html");
  });

  it("names the pages a build writes for a stream's tags, and none for a manual page's", () => {
    const pages = [
      post("blog/a.html", "2026-10-01", ["Design", "Notes"]),
      post("guide/x.html", "2026-10-01", ["Ignored"]),
    ];
    expect(streamTagPaths(layout, pages)).toEqual([
      "blog/tags/index.html",
      "blog/tags/design.html",
      "blog/tags/notes.html",
    ]);
    expect(streamTagPaths(layout, [post("blog/a.html", "2026-10-01", undefined)])).toEqual([]);
  });

  it("finds a tag that has no page to be listed on", () => {
    const pages = [post("blog/a.html", "2026-10-01", ["/?#", "Index", "ok"])];
    expect(tagProblems(layout, pages)).toEqual([
      'blog/a.html: tag "/?#" has no letters or digits to name its page',
      'blog/a.html: tag "Index" would be written at blog/tags/index.html, the list of all tags',
    ]);
  });
});
