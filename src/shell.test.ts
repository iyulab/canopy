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
    outline: [],
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

  // An index page is named for what it opens, the same way the navigation tree
  // names it. A title is the string that leaves the site — the tab, the
  // bookmark, the search result — so "index" there is the renderer disagreeing
  // with its own sidebar in the more visible of the two places.
  it("names the root index page for the site's front, not its filename", () => {
    expect(pageTitle(page({ sitePath: "index.html" }))).toBe("Home");
  });

  it("names a folder's index page for the folder it opens", () => {
    expect(pageTitle(page({ sitePath: "guide/settings/index.html" }))).toBe("settings");
  });

  it("still prefers a frontmatter title on an index page", () => {
    expect(
      pageTitle(page({ sitePath: "index.html", frontmatter: { title: "Welcome" } })),
    ).toBe("Welcome");
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

describe("page outline", () => {
  const outline = [
    { level: 2, text: "First", id: "first" },
    { level: 3, text: "Detail", id: "detail" },
    { level: 2, text: "Second", id: "second" },
  ];

  it("renders the headings as same-page anchors, nested by depth", () => {
    const html = renderPage(page({ outline }), nav);
    expect(html).toContain('<nav class="canopy-outline" aria-label="On this page">');
    expect(html).toContain('<li class="canopy-outline-l0"><a href="#first">First</a></li>');
    expect(html).toContain(
      '<li class="canopy-outline-l1"><a href="#detail">Detail</a></li>',
    );
    // No script: the anchors point at ids the page already carries.
    expect(html).not.toContain("<script");
  });

  it("omits an outline that would not help", () => {
    expect(renderPage(page({ outline: [] }), nav)).not.toContain("canopy-outline");
    // One entry is not a structure to navigate.
    expect(
      renderPage(page({ outline: [{ level: 2, text: "Only", id: "only" }] }), nav),
    ).not.toContain("canopy-outline");
  });

  it("indents relative to the shallowest heading present", () => {
    // A page whose headings start at h3 should not be indented as if an absent
    // h2 were above them.
    const html = renderPage(
      page({
        outline: [
          { level: 3, text: "A", id: "a" },
          { level: 3, text: "B", id: "b" },
        ],
      }),
      nav,
    );
    expect(html).toContain('class="canopy-outline-l0"><a href="#a">');
    expect(html).not.toContain("canopy-outline-l1");
  });

  it("escapes outline text and ids", () => {
    const html = renderPage(
      page({
        outline: [
          { level: 2, text: '<script>alert(1)</script>', id: 'x"><script>' },
          { level: 2, text: "Second", id: "second" },
        ],
      }),
      nav,
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain('href="#x"><script>');
  });
});

describe("document metadata", () => {
  it("declares the language, defaulting to en", () => {
    expect(renderPage(page(), nav)).toContain('<html lang="en">');
    expect(renderPage(page(), nav, { lang: "ko-KR" })).toContain('<html lang="ko-KR">');
  });

  it("links a favicon relative to the page, with a type hint", () => {
    const html = renderPage(page(), nav, { iconPath: "assets/favicon.png" });
    // Relative, like every other link — an absolute /favicon.ico is exactly what
    // breaks when the site is served from a sub-path.
    expect(html).toContain(
      '<link rel="icon" type="image/png" href="../assets/favicon.png">',
    );
  });

  it("infers the icon type from the extension, omitting it when unknown", () => {
    for (const [path, type] of [
      ["a.svg", "image/svg+xml"],
      ["a.ico", "image/x-icon"],
    ] as const) {
      expect(renderPage(page(), nav, { iconPath: path })).toContain(`type="${type}"`);
    }
    // Better to link without a hint than to assert a type canopy guessed.
    const unknown = renderPage(page(), nav, { iconPath: "a.weird" });
    expect(unknown).toContain('<link rel="icon" href="../a.weird">');
  });

  it("emits a description only when given one", () => {
    expect(renderPage(page(), nav, { description: "Product help" })).toContain(
      '<meta name="description" content="Product help">',
    );
    expect(renderPage(page(), nav)).not.toContain('name="description"');
  });

  it("escapes metadata values", () => {
    const html = renderPage(page(), nav, {
      description: '"><script>alert(1)</script>',
      lang: '"><x',
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('lang=""><x"');
  });
});
