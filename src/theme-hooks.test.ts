import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { build } from "./index.js";
import { emitSite } from "./emit.js";
import { THEME_HOOKS } from "./theme-hooks.js";

/** Every class name used across a set of emitted HTML files. */
function classesIn(htmlFiles: string[]): Set<string> {
  const classes = new Set<string>();
  for (const html of htmlFiles) {
    for (const match of html.matchAll(/class="([^"]*)"/g)) {
      for (const name of (match[1] as string).split(/\s+/)) if (name !== "") classes.add(name);
    }
  }
  return classes;
}

/** Two sites between them exercise every hook: one with a front page, one without (contents page). */
async function emittedHtml(): Promise<string[]> {
  const full = await build({
    documents: [
      { path: "index.md", content: "# Home\n\nSee [[guide/install]].\n" },
      {
        path: "guide/install.md",
        content: [
          "---",
          "date: 2026-01-02",
          "---",
          "# Install",
          "",
          "## Before",
          "text",
          "",
          "## After",
          "text",
          "",
          "> [!note]\n> n",
          "",
          "> [!tip]\n> t",
          "",
          "> [!warning]\n> w",
          "",
          "> [!danger]\n> d",
          "",
          "> [!quote]\n> q",
        ].join("\n"),
      },
      { path: "guide/configure.md", content: "# Configure\n\nBack to [[guide/install]].\n" },
      { path: "notes/index.md", content: "---\nlisting: true\n---\n# Notes\n" },
      { path: "notes/one.md", content: "# One\n" },
    ],
  });
  const options = {
    siteTitle: "Site",
    logoPath: "logo.svg",
    homeUrl: "https://example.test/",
    homeLabel: "Home",
    searchIndexPath: "search-index.json",
  };
  const contentsOnly = await build({ documents: [{ path: "a/b.md", content: "# B\n" }] });
  const streamLayout = {
    dirs: {
      blog: {
        profile: "stream" as const,
        title: "Blog",
        regions: { header: "h.html", beforeArticle: "b.html", afterArticle: "a.html" },
      },
    },
  };
  const stream = await build({
    documents: [
      {
        path: "blog/post.md",
        content: "---\ndate: 2026-10-03\ndescription: Lead.\n---\n# Post\n\n## One\n\na\n\n## Two\n\nb\n",
      },
    ],
    layout: streamLayout,
  });
  const streamOptions = {
    ...options,
    siteUrl: "https://example.test/en",
    lang: "en",
    alternates: { ko: "https://example.test/ko" },
    layout: streamLayout,
    fragments: {
      "h.html":
        '<header><canopy-slot name="site-title"></canopy-slot><canopy-slot name="back"></canopy-slot>' +
        '<canopy-slot name="language"></canopy-slot></header>',
      "b.html": "<p>before</p>",
      "a.html": "<p>after</p>",
    },
  };
  return [...emitSite(full, options), ...emitSite(contentsOnly, options), ...emitSite(stream, streamOptions)]
    .filter((file) => file.path.endsWith(".html"))
    .map((file) => file.contents);
}

describe("THEME_HOOKS", () => {
  it("is frozen, so no caller can add to or remove from the contract at runtime", () => {
    expect(Object.isFrozen(THEME_HOOKS)).toBe(true);
  });

  it("lists no hook twice", () => {
    expect(new Set(THEME_HOOKS).size).toBe(THEME_HOOKS.length);
  });

  // A hook a site can no longer find is a stylesheet that silently stops matching.
  it("names only classes the shell actually emits", async () => {
    const emitted = classesIn(await emittedHtml());
    expect(THEME_HOOKS.filter((hook) => !emitted.has(hook))).toEqual([]);
  });
});

describe("docs/THEMING.md", () => {
  const DOC = path.join(import.meta.dirname, "..", "docs", "THEMING.md");

  it("documents every hook", async () => {
    const doc = await readFile(DOC, "utf8");
    expect(THEME_HOOKS.filter((hook) => !doc.includes(`\`.${hook}\``))).toEqual([]);
  });

  // The document is the contract readers see; a class it shows that is not a
  // hook would be promised to them without the test above guarding it.
  it("presents no class as a hook that is not one", async () => {
    const doc = await readFile(DOC, "utf8");
    const shown = [...doc.matchAll(/`\.((?:canopy|callout)[a-z0-9-]*)`/g)].map((m) => m[1] as string);
    expect(shown.filter((name) => !(THEME_HOOKS as readonly string[]).includes(name))).toEqual([]);
  });
});
