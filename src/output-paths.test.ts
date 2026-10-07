import { describe, expect, it } from "vitest";
import { outputCollisions } from "./output-paths.js";
import { parseLayout } from "./layout.js";

describe("outputCollisions", () => {
  it("finds nothing when no published file lands on a path canopy writes", () => {
    expect(
      outputCollisions(["index.md", "brand.css", "assets/fonts/inter.woff2"], {
        pages: ["index.md"],
        stylesheets: 1,
        script: true,
        searchIndexPath: "search-index.json",
        feeds: ["blog"],
      }),
    ).toEqual([]);
  });

  it("reserves canopy's own stylesheets and KaTeX's files whatever the build is asked to do", () => {
    expect(
      outputCollisions(["Tokens.css", "styles.css", "assets/katex.css", "assets/fonts/KaTeX_Main-Regular.woff2"], {
        pages: [],
      }),
    ).toEqual([
      { path: "Tokens.css", owner: { kind: "tokens" } },
      { path: "styles.css", owner: { kind: "styles" } },
      { path: "assets/katex.css", owner: { kind: "katex" } },
      { path: "assets/fonts/KaTeX_Main-Regular.woff2", owner: { kind: "katex" } },
    ]);
  });

  it("reserves what the invocation adds: carried stylesheets, script, search index and feeds", () => {
    const published = [
      "assets/stylesheet-1.css",
      "assets/stylesheet-2.css",
      "assets/script.js",
      "search-index.json",
      "blog/feed.xml",
      "feed.xml",
    ];
    expect(
      outputCollisions(published, {
        pages: [],
        stylesheets: 1,
        script: true,
        searchIndexPath: "search-index.json",
        feeds: ["./blog/", "."],
      }),
    ).toEqual([
      { path: "assets/stylesheet-1.css", owner: { kind: "stylesheet", index: 0 } },
      { path: "assets/script.js", owner: { kind: "script" } },
      { path: "search-index.json", owner: { kind: "search-index" } },
      { path: "blog/feed.xml", owner: { kind: "feed", dir: "blog" } },
      { path: "feed.xml", owner: { kind: "feed", dir: "" } },
    ]);
    // Without the flags, the same files are the vault's to publish.
    expect(outputCollisions(published, { pages: [] })).toEqual([]);
  });

  it("reserves each page's HTML path and the index page a stream folder gets", () => {
    const layout = parseLayout(JSON.stringify({ dirs: { blog: { profile: "stream" } } }));
    expect(
      outputCollisions(["guide/a.html", "blog/index.html", "guide/b.html"], {
        pages: ["guide/a.md", "blog/post.md"],
        layout,
      }),
    ).toEqual([
      { path: "guide/a.html", owner: { kind: "page", page: "guide/a.md" } },
      { path: "blog/index.html", owner: { kind: "stream-index", dir: "blog" } },
    ]);
  });
});
