import { describe, expect, it } from "vitest";
import type { RenderedPage } from "./contract.js";
import { emitSite } from "./emit.js";
import { atomDate, datedPagesUnder, feedPath, feedTitle, normalizeFeedDir, renderFeed } from "./feed.js";
import type { NavNode } from "./navigation.js";
import { build } from "./index.js";

function page(sitePath: string, frontmatter: Record<string, unknown> = {}, html = ""): RenderedPage {
  return { sourcePath: sitePath.replace(/\.html$/, ".md"), sitePath, frontmatter, html, backlinks: [], outline: [] };
}

const pages: RenderedPage[] = [
  page("index.html", {}, "<h1>Home</h1>"),
  page("log/index.html", { date: "2026-01-01" }, "<h1>Changes</h1>"),
  page("log/2026-09-28.html", { date: "2026-09-28", description: "Feeds & dates" }, "<h1>Dated pages</h1>"),
  page("log/2026-10-01.html", { date: "2026-10-01T09:30+0900", updated: "2026-10-02", author: "Jane" }, "<h1>Later</h1>"),
  page("log/undated.html", {}, "<h1>No date</h1>"),
  page("guide/a.html", { date: "2026-05-05" }, "<h1>A</h1>"),
];
const nav: NavNode[] = [];
const site = { siteUrl: "https://example.org/docs", siteTitle: "Docs", lang: "en" };

describe("feed paths", () => {
  it("normalizes a folder the way an author might write it", () => {
    for (const dir of ["log", "log/", "./log", "/log/", "log\\"]) expect(normalizeFeedDir(dir)).toBe("log");
    for (const dir of [".", "./", "", "/"]) expect(normalizeFeedDir(dir)).toBe("");
  });

  it("publishes a folder's feed beside its pages", () => {
    expect(feedPath("log")).toBe("log/feed.xml");
    expect(feedPath("")).toBe("feed.xml");
  });
});

describe("atomDate", () => {
  it("writes every date in the full RFC 3339 form Atom requires", () => {
    expect(atomDate("2026-09-28")).toBe("2026-09-28T00:00:00Z");
    expect(atomDate("2026-09-28T09:30")).toBe("2026-09-28T09:30:00Z");
    expect(atomDate("2026-09-28T09:30:15.5+0900")).toBe("2026-09-28T09:30:15.5+09:00");
    expect(atomDate("2026-09-28T09:30z")).toBe("2026-09-28T09:30:00Z");
    expect(atomDate(undefined)).toBeUndefined();
  });
});

describe("datedPagesUnder", () => {
  it("lists a folder's dated pages newest first, without the page that fronts it", () => {
    expect(datedPagesUnder(pages, "log").map((p) => p.sitePath)).toEqual([
      "log/2026-10-01.html",
      "log/2026-09-28.html",
    ]);
  });

  it("takes the whole site for the root", () => {
    expect(datedPagesUnder(pages, "").map((p) => p.sitePath)).toEqual([
      "log/2026-10-01.html",
      "log/2026-09-28.html",
      "guide/a.html",
      "log/index.html",
    ]);
  });
});

describe("feedTitle", () => {
  it("names a folder's feed the way the site names the folder", () => {
    expect(feedTitle(pages, nav, "log", "Docs")).toBe("Changes · Docs");
    expect(feedTitle(pages, nav, "", "Docs")).toBe("Docs");
    const labelled: NavNode[] = [
      { label: "Guides", children: [{ label: "A", sitePath: "guide/a.html", children: [] }] },
    ];
    expect(feedTitle(pages, labelled, "guide", "Docs")).toBe("Guides · Docs");
    expect(feedTitle(pages, nav, "guide", undefined)).toBe("guide");
  });
});

describe("renderFeed", () => {
  const xml = renderFeed(pages, nav, "log", site) ?? "";

  it("writes a well-formed Atom document", () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">')).toBe(true);
    expect(xml).toContain("<title>Changes · Docs</title>");
    expect(xml).toContain("<id>https://example.org/docs/log/feed.xml</id>");
    expect(xml).toContain('<link rel="self" type="application/atom+xml" href="https://example.org/docs/log/feed.xml"/>');
    expect(xml).toContain('<link rel="alternate" type="text/html" href="https://example.org/docs/log/"/>');
    expect(xml).toContain("<author><name>Docs</name></author>");
    expect(new DOMParserLike(xml).wellFormed).toBe(true);
  });

  it("dates the feed by its most recently changed entry", () => {
    expect(xml).toContain('href="https://example.org/docs/log/"/><updated>2026-10-02T00:00:00Z</updated><author><name>Docs');
  });

  it("lists each dated page with what it says about itself", () => {
    expect(xml).toContain(
      "<entry><title>Later</title>" +
        '<link rel="alternate" type="text/html" href="https://example.org/docs/log/2026-10-01.html"/>' +
        "<id>https://example.org/docs/log/2026-10-01.html</id>" +
        "<published>2026-10-01T09:30:00+09:00</published><updated>2026-10-02T00:00:00Z</updated>" +
        "<author><name>Jane</name></author></entry>",
    );
    expect(xml).toContain("<published>2026-09-28T00:00:00Z</published><updated>2026-09-28T00:00:00Z</updated><summary>Feeds &amp; dates</summary>");
    expect(xml).not.toContain("No date");
    expect(xml.indexOf("Later")).toBeLessThan(xml.indexOf("Dated pages"));
  });

  it("writes nothing for a folder with no dated page", () => {
    expect(renderFeed([page("x/a.html")], nav, "x", site)).toBeUndefined();
  });

  it("omits the alternate link when the folder has no front page to visit", () => {
    const guide = renderFeed(pages, nav, "guide", site) ?? "";
    expect(guide).toContain('<link rel="self"');
    expect(guide).not.toContain('href="https://example.org/docs/guide/"');
  });
});

describe("emitSite feeds", () => {
  const bundle = { pages, navigation: nav };

  it("writes the feed and links it from the folder's pages only", () => {
    const files = emitSite(bundle, { ...site, feeds: ["log/", "empty"] });
    const byPath = new Map(files.map((f) => [f.path, f.contents]));
    expect(byPath.has("log/feed.xml")).toBe(true);
    expect(byPath.has("empty/feed.xml")).toBe(false);
    const link = '<link rel="alternate" type="application/atom+xml" title="Changes · Docs" href="feed.xml">';
    expect(byPath.get("log/2026-09-28.html")).toContain(link);
    expect(byPath.get("log/index.html")).toContain(link);
    expect(byPath.get("guide/a.html")).not.toContain("application/atom+xml");
  });

  it("writes no feed without a site URL to make it absolute", () => {
    const files = emitSite(bundle, { feeds: ["log"] });
    expect(files.some((f) => f.path.endsWith("feed.xml"))).toBe(false);
    expect(files.find((f) => f.path === "log/index.html")?.contents).not.toContain("atom+xml");
  });
});

/** Minimal well-formedness check: every element closes in order (no DOM in the test environment). */
class DOMParserLike {
  wellFormed: boolean;
  constructor(xml: string) {
    const stack: string[] = [];
    let ok = true;
    for (const [, close, name, selfClose] of xml.replace(/<\?xml[^>]*\?>/, "").matchAll(/<(\/?)([a-zA-Z:]+)[^>]*?(\/?)>/g)) {
      if (selfClose) continue;
      if (close) ok = ok && stack.pop() === name;
      else stack.push(name as string);
    }
    this.wellFormed = ok && stack.length === 0;
  }
}

describe("a stream folder's feed", () => {
  // The front page a stream folder gets written is a page like the folder's own
  // would be: the feed is named after it and links to it.
  it("is named after the index page written for the folder, and links to it", async () => {
    const bundle = await build({
      documents: [{ path: "news/a.md", content: "---\ndate: 2026-10-01\n---\n# A\n" }],
      layout: { dirs: { news: { profile: "stream", title: "News" } } },
    });
    const files = emitSite(bundle, { ...site, feeds: ["news"] });
    const feed = files.find((f) => f.path === "news/feed.xml")?.contents ?? "";
    expect(feed).toContain("<title>News · Docs</title>");
    expect(feed).toContain('<link rel="alternate" type="text/html" href="https://example.org/docs/news/"/>');
  });
});
