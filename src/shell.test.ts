import { describe, expect, it } from "vitest";
import { renderPage, pageTitle, renderContentsPage } from "./shell.js";
import type { RenderedPage } from "./contract.js";
import type { NavNode } from "./navigation.js";

function page(overrides: Partial<RenderedPage> = {}): RenderedPage {
  return {
    sourcePath: "notes/idea.md",
    sitePath: "notes/idea.html",
    frontmatter: {},
    html: "<p>Body</p>",
    backlinks: [],
    ...overrides,
  };
}

const nav: NavNode[] = [
  { label: "notes", children: [{ label: "idea", sitePath: "notes/idea.html", children: [] }] },
  { label: "Home", sitePath: "index.html", children: [] },
];

describe("pageTitle", () => {
  it("prefers the frontmatter title", () => {
    expect(pageTitle(page({ frontmatter: { title: "My Idea" } }))).toBe("My Idea");
  });
  it("falls back to the filename stem", () => {
    expect(pageTitle(page())).toBe("idea");
  });
});

describe("renderPage", () => {
  it("produces a complete HTML document", () => {
    const html = renderPage(page(), nav);
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain("<title>idea</title>");
    expect(html).toContain("<p>Body</p>");
  });

  it("links the stylesheet relative to the page", () => {
    const html = renderPage(page(), nav);
    // notes/idea.html -> ../styles.css
    expect(html).toContain('href="../styles.css"');
  });

  it("renders navigation links relative to the current page", () => {
    const html = renderPage(page(), nav);
    expect(html).toContain('href="idea.html"'); // sibling in same folder
    expect(html).toContain('href="../index.html"'); // root from a folder
  });

  it("renders a backlinks section when present", () => {
    const html = renderPage(
      page({ backlinks: [{ sitePath: "notes/plan.html", title: "The Plan" }] }),
      nav,
    );
    expect(html).toContain("Linked references");
    expect(html).toContain('href="plan.html"');
    expect(html).toContain(">The Plan</a>");
  });

  it("omits the backlinks section when there are none", () => {
    expect(renderPage(page(), nav)).not.toContain("canopy-backlinks");
  });

  it("escapes HTML in titles and labels", () => {
    const html = renderPage(page({ frontmatter: { title: "<x> & 'y'" } }), nav);
    expect(html).toContain("<title>&lt;x&gt; &amp; &#39;y&#39;</title>");
    expect(html).not.toContain("<title><x>");
  });
});

describe("renderContentsPage", () => {
  const contentsNav: NavNode[] = [
    { label: "notes", children: [{ label: "Idea", sitePath: "notes/idea.html", children: [] }] },
    { label: "Welcome", sitePath: "Welcome.html", children: [] },
  ];

  it("renders a complete root document linking every page", () => {
    const html = renderContentsPage(contentsNav);
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain("<h1>Contents</h1>");
    expect(html).toContain('class="canopy-contents"');
    // Hrefs are relative to the root, so they are the site paths verbatim.
    expect(html).toContain('href="notes/idea.html"');
    expect(html).toContain('href="Welcome.html"');
  });

  it("titles the document with the site title when provided", () => {
    const html = renderContentsPage(contentsNav, { siteTitle: "My Vault" });
    expect(html).toContain("<title>Contents · My Vault</title>");
    const bare = renderContentsPage(contentsNav);
    expect(bare).toContain("<title>Contents</title>");
  });

  it("renders a valid document for an empty site", () => {
    const html = renderContentsPage([]);
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain("<h1>Contents</h1>");
  });
});
