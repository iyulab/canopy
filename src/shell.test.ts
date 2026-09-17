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

  // A document that opens with `# 주문 목록` has already said what it is called.
  // Reaching past that for the filename names the page something its own author
  // never wrote — and on a non-English site the filename is usually an ASCII
  // identifier, so the name that leaves the site is in the wrong language.
  it("takes the document's own h1 over the filename", () => {
    expect(pageTitle(page({ html: '<h1 id="order-list">주문 목록</h1>' }))).toBe("주문 목록");
  });

  it("still prefers frontmatter over the h1", () => {
    expect(
      pageTitle(page({ frontmatter: { title: "Explicit" }, html: "<h1>Heading</h1>" })),
    ).toBe("Explicit");
  });

  it("names an index page for its h1 rather than for what it opens", () => {
    // The positional rules ("Home", the folder name) answer "this page has no
    // name of its own". An h1 is a name of its own, so it wins over both.
    expect(pageTitle(page({ sitePath: "index.html", html: "<h1>Welcome</h1>" }))).toBe(
      "Welcome",
    );
    expect(
      pageTitle(page({ sitePath: "guide/settings/index.html", html: "<h1>설정</h1>" })),
    ).toBe("설정");
  });

  it("keeps the positional name when an index page has no h1", () => {
    expect(pageTitle(page({ sitePath: "index.html", html: "<p>Body</p>" }))).toBe("Home");
  });

  it("names a backlink the same way, never 'index'", () => {
    const html = renderPage(
      page({
        backlinks: [
          { sitePath: "guide/index.html", title: undefined },
          { sitePath: "order/list.html", title: "주문 목록" },
        ],
      }),
      nav,
    );
    expect(html).toContain(">guide</a>");
    expect(html).toContain(">주문 목록</a>");
    expect(html).not.toContain(">index</a>");
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

  it("overrides the backlinks heading via strings.backlinks", () => {
    const html = renderPage(
      page({ backlinks: [{ sitePath: "notes/plan.html", title: "The Plan" }] }),
      nav,
      { strings: { backlinks: "관련 문서" } },
    );
    expect(html).toContain("관련 문서");
    expect(html).not.toContain("Linked references");
  });

  describe("page navigation (prev/next)", () => {
    // "idea" is nav's first flattened entry, "Home" its second and last —
    // so idea has a next (Home) but no prev.
    it("links to the next page in the sidebar's own order", () => {
      const html = renderPage(page(), nav);
      expect(html).toContain('<a class="canopy-next" rel="next" href="../index.html">Home</a>');
      expect(html).not.toContain('class="canopy-prev"');
    });

    it("links to the previous page from the last page, with no next", () => {
      const html = renderPage(page({ sitePath: "index.html" }), nav);
      expect(html).toContain('<a class="canopy-prev" rel="prev" href="notes/idea.html">idea</a>');
      expect(html).not.toContain('class="canopy-next"');
    });

    it("renders both neighbors for a page in the middle of the order", () => {
      const three: NavNode[] = [
        { label: "a", sitePath: "a.html", children: [] },
        { label: "b", sitePath: "b.html", children: [] },
        { label: "c", sitePath: "c.html", children: [] },
      ];
      const html = renderPage(page({ sitePath: "b.html" }), three);
      expect(html).toContain('<a class="canopy-prev" rel="prev" href="a.html">a</a>');
      expect(html).toContain('<a class="canopy-next" rel="next" href="c.html">c</a>');
    });

    it("omits the section entirely for a single-page tree", () => {
      const html = renderPage(page(), [{ label: "idea", sitePath: "notes/idea.html", children: [] }]);
      expect(html).not.toContain("canopy-page-nav");
    });

    it("omits the section for a page the navigation tree does not place", () => {
      const html = renderPage(page({ sitePath: "orphan.html" }), nav);
      expect(html).not.toContain("canopy-page-nav");
    });

    it("uses the neighbor's own nav label, not a re-derived title", () => {
      const labeled: NavNode[] = [
        { label: "Custom Label", sitePath: "a.html", children: [] },
        { label: "b", sitePath: "b.html", children: [] },
      ];
      const html = renderPage(page({ sitePath: "b.html" }), labeled);
      expect(html).toContain(">Custom Label</a>");
    });
  });

  it("omits the backlinks section when there are none", () => {
    expect(renderPage(page(), nav)).not.toContain("canopy-backlinks");
  });

  it("escapes HTML in titles and labels", () => {
    const html = renderPage(page({ frontmatter: { title: "<x> & 'y'" } }), nav);
    expect(html).toContain("<title>&lt;x&gt; &amp; &#39;y&#39;</title>");
    expect(html).not.toContain("<title><x>");
  });

  it("puts the logo and the home link in a top bar above the layout grid", () => {
    const html = renderPage(page({ sitePath: "guide/install.html" }), nav, {
      siteTitle: "Product Help",
      logoPath: "assets/logo.svg",
      homeUrl: "https://example.test/",
      homeLabel: "제품 홈",
    });
    // Relative like every other asset, so it resolves from a sub-path.
    expect(html).toContain('src="../assets/logo.svg"');
    // Decorative: the site title beside it already names the site.
    expect(html).toContain('alt=""');
    expect(html).toContain('href="https://example.test/"');
    expect(html).toContain("제품 홈");
    // Marked as leaving the site — see the dedicated describe block below
    // for the internal/external distinction itself.
    expect(html).toContain('class="canopy-home canopy-home-external"');
    // The top bar wraps the header content and sits outside (before) the
    // sidebar/main grid, not inside the sidebar.
    const topbarStart = html.indexOf('<header class="canopy-topbar">');
    const layoutStart = html.indexOf('<div class="canopy-layout">');
    const sidebarStart = html.indexOf('<aside class="canopy-sidebar">');
    expect(topbarStart).toBeGreaterThan(-1);
    expect(topbarStart).toBeLessThan(layoutStart);
    expect(layoutStart).toBeLessThan(sidebarStart);
    // The header content itself is no longer inside the sidebar.
    const sidebarSection = html.slice(sidebarStart, html.indexOf("</aside>"));
    expect(sidebarSection).not.toContain("canopy-site-title");
  });

  // An absolute homeUrl addresses something outside the site and is emitted
  // exactly as given (the test above covers that). A relative one instead
  // names a path from the site's own root — as `home.url: "../"` does for a
  // product the site sits one level beneath — and every other internal link
  // this function writes already adjusts for how deep the current page sits,
  // so this one has to as well or it is only ever right at the site root.
  it("resolves a relative home link against the page's depth in the site", () => {
    const deep = renderPage(page({ sitePath: "guide/master/install.html" }), nav, {
      homeUrl: "../",
      homeLabel: "Product",
    });
    expect(deep).toContain('href="../../../"');

    const shallow = renderPage(page({ sitePath: "index.html" }), nav, {
      homeUrl: "../",
      homeLabel: "Product",
    });
    expect(shallow).toContain('href="../"');
  });

  // A root-absolute href already means "the domain root" regardless of the
  // current page's depth — it needs no adjustment, and depth-prefixing it
  // (as a naive "is this relative" check would) mangles it into "..//".
  it("leaves a root-absolute home link exactly as given, at any depth", () => {
    const html = renderPage(page({ sitePath: "guide/master/install.html" }), nav, {
      homeUrl: "/",
      homeLabel: "Product",
    });
    expect(html).toContain('href="/"');
  });

  // home sits right after the breadcrumb in the topbar, and the breadcrumb
  // never leaves the site — a reader has every reason to expect the same of
  // home unless canopy tells them otherwise. It already knows which case it
  // is (the relative/root-absolute tests above use the same isExternalUrl
  // check to decide whether to depth-prefix the href), so marking it is
  // exposing information canopy already has, not inferring anything new.
  describe("marking an external home link", () => {
    it("adds canopy-home-external for an absolute URL", () => {
      const html = renderPage(page(), nav, { homeUrl: "https://example.test/", homeLabel: "Product" });
      expect(html).toContain('class="canopy-home canopy-home-external"');
    });

    it("does not mark a relative home link", () => {
      const html = renderPage(page(), nav, { homeUrl: "../", homeLabel: "Product" });
      expect(html).toContain('class="canopy-home"');
      expect(html).not.toContain("canopy-home-external");
    });

    it("does not mark a root-absolute home link — it stays on the same site, just at its domain root", () => {
      const html = renderPage(page(), nav, { homeUrl: "/", homeLabel: "Product" });
      expect(html).toContain('class="canopy-home"');
      expect(html).not.toContain("canopy-home-external");
    });

    it("marks a protocol-relative URL — a different host, even without an explicit scheme", () => {
      const html = renderPage(page(), nav, { homeUrl: "//other.example/", homeLabel: "Product" });
      expect(html).toContain('class="canopy-home canopy-home-external"');
    });
  });

  it("marks the sidebar link to the page being rendered as the current one", () => {
    // `page()`'s sitePath is "notes/idea.html", which `nav` also names.
    const html = renderPage(page(), nav);
    const sidebar = html.slice(html.indexOf("canopy-sidebar"), html.indexOf("canopy-main"));
    expect(sidebar).toContain('<a href="idea.html" aria-current="page">idea</a>');
  });

  it("leaves every other sidebar link unmarked", () => {
    const html = renderPage(page(), nav);
    const sidebar = html.slice(html.indexOf("canopy-sidebar"), html.indexOf("canopy-main"));
    expect(sidebar).toContain('<a href="../index.html">Home</a>');
  });

  it("marks no sidebar link current for a page the nav does not list", () => {
    const html = renderPage(page({ sitePath: "orphan.html" }), nav);
    expect(html).not.toContain("aria-current");
  });

  it("omits the logo and home link when they are not given", () => {
    const html = renderPage(page(), nav, { siteTitle: "Product Help" });
    expect(html).not.toContain("canopy-logo");
    expect(html).not.toContain("canopy-home");
  });

  it("renders a hidden search form in the top bar when search is enabled", () => {
    const html = renderPage(page(), nav, { siteTitle: "Product Help", search: true });
    const topbarStart = html.indexOf('<header class="canopy-topbar">');
    const topbarEnd = html.indexOf("</header>");
    expect(topbarStart).toBeGreaterThan(-1);
    const topbarSection = html.slice(topbarStart, topbarEnd);
    expect(topbarSection).toContain('<form class="canopy-search" role="search" hidden>');
    expect(topbarSection).toContain('<input type="search"');
    // A blank box with no hint of what it's for reads as broken, not empty —
    // the placeholder carries the same text the aria-label already does.
    expect(topbarSection).toContain('placeholder="Search"');
    // A script wires it up and reveals it; without one, hidden keeps a broken
    // control from ever being seen (see docs/SCOPE.md — canopy carries scripts
    // it is given, it does not author them).
    expect(topbarSection).toContain("hidden");
  });

  it("still puts up a top bar for search alone, with no title/logo/home", () => {
    const html = renderPage(page(), nav, { search: true });
    expect(html).toContain('<header class="canopy-topbar">');
    expect(html).toContain("canopy-search");
  });

  it("omits the search form entirely when search is not enabled", () => {
    const html = renderPage(page(), nav, { siteTitle: "Product Help" });
    expect(html).not.toContain("canopy-search");
  });

  it("puts a hidden theme toggle in the top bar whenever one exists", () => {
    const html = renderPage(page(), nav, { siteTitle: "Product Help" });
    const topbarStart = html.indexOf('<header class="canopy-topbar">');
    const topbarSection = html.slice(topbarStart, html.indexOf("</header>"));
    expect(topbarSection).toContain('<button type="button" class="canopy-theme-toggle" hidden');
  });

  it("does not manufacture a top bar just to hold the theme toggle", () => {
    // No title, logo, home, or search — today's chrome-free top edge for a
    // genuinely bare site must survive the toggle's addition.
    const html = renderPage(page(), nav);
    expect(html).not.toContain("canopy-topbar");
    expect(html).not.toContain("canopy-theme-toggle");
  });

  // `lang` only changes what <html lang> declares; it was silently not enough
  // on its own — every literal here stayed English regardless, which is the
  // defect this closes. Unset keys keep their English default, the same
  // fallback shape `stylesheets`/`iconPath` already use.
  it("overrides the reader chrome's built-in strings, leaving unset ones at their default", () => {
    const html = renderPage(
      page({
        outline: [
          { level: 2, text: "First", id: "first" },
          { level: 2, text: "Second", id: "second" },
        ],
      }),
      nav,
      {
        search: true,
        strings: {
          search: "검색",
          toggleTheme: "테마 전환",
          siteNav: "사이트 메뉴",
          pageNav: "페이지 이동",
          onThisPage: "이 페이지에서",
        },
      },
    );
    expect(html).toContain('aria-label="검색"');
    expect(html).toContain('aria-label="테마 전환"');
    expect(html).toContain('aria-label="사이트 메뉴"');
    expect(html).toContain('aria-label="페이지 이동"');
    expect(html).toContain('aria-label="이 페이지에서"');
    expect(html).not.toContain("Search");
    expect(html).not.toContain("Toggle color theme");
  });

  it("falls back to English strings when no override is given", () => {
    const html = renderPage(page({ sitePath: "guide/install.html" }), nav, { search: true });
    expect(html).toContain('aria-label="Search"');
    expect(html).toContain('aria-label="Toggle color theme"');
    expect(html).toContain('aria-label="Site navigation"');
  });

  it("links a caller-supplied script, deferred and relative to the page", () => {
    const html = renderPage(page({ sitePath: "guide/install.html" }), nav, {
      scriptPath: "assets/script.js",
    });
    expect(html).toContain('<script defer src="../assets/script.js"></script>');
  });

  it("omits the script tag when no script path is given", () => {
    expect(renderPage(page(), nav)).not.toContain("<script");
  });

  it("wraps the navigation in a disclosure that starts open", () => {
    const html = renderPage(page({ sitePath: "index.html" }), nav, { siteTitle: "Product Help" });
    expect(html).toContain('<details class="canopy-nav" open>');
    // Labelled for assistive technology; the summary itself is a CSS-drawn control.
    expect(html).toContain('aria-label="Site navigation"');
  });

  // Depth is a value the NavNode tree already carries — renderOutline exposes it as
  // canopy-outline-l{n} for the same reason: without it in the DOM, a consumer wanting
  // to style deeper levels differently has no way to do so short of re-deriving depth
  // from <ul> nesting.
  it("marks each nav item with its tree depth, the same way the outline does", () => {
    const html = renderPage(page(), nav);
    // top-level: "notes" (has children) and "Home" (leaf)
    expect(html).toContain('<li class="canopy-nav-l0">');
    // one level in: "idea", a child of "notes"
    expect(html).toContain('<li class="canopy-nav-l1">');
  });

  it("wraps a folder node's children in a collapsible group, but leaves a leaf as a plain item", () => {
    const html = renderPage(page(), nav);
    expect(html).toContain('<li class="canopy-nav-l0"><details class="canopy-nav-group"');
    expect(html).toContain("<summary><span>notes</span></summary>");
    // "Home" is a leaf (no children) — no <details> wrapper for it.
    expect(html).toContain('<li class="canopy-nav-l0"><a href="../index.html">Home</a></li>');
  });

  it("opens a group whose subtree contains the current page, and leaves an unrelated one closed", () => {
    const branching: NavNode[] = [
      { label: "notes", children: [{ label: "idea", sitePath: "notes/idea.html", children: [] }] },
      { label: "other", children: [{ label: "thing", sitePath: "other/thing.html", children: [] }] },
    ];
    const html = renderPage(page(), branching);
    // page() is "notes/idea.html" — the "notes" group's subtree contains it,
    // "other"'s does not.
    expect(html).toContain('<details class="canopy-nav-group" open><summary><span>notes</span>');
    expect(html).toContain('<details class="canopy-nav-group"><summary><span>other</span>');
  });

  it("navigating a linked group node's own link works the same as any other link", () => {
    // A group whose own node has a sitePath (a folder with its own index
    // page) still links from inside <summary> — the group being collapsible
    // doesn't cost the folder's own page a way to reach it directly.
    const linkedGroup: NavNode[] = [
      {
        label: "guide",
        sitePath: "guide/index.html",
        children: [{ label: "install", sitePath: "guide/install.html", children: [] }],
      },
    ];
    const html = renderPage(page({ sitePath: "guide/install.html" }), linkedGroup);
    expect(html).toContain('<summary><a href="index.html">guide</a></summary>');
  });
});

describe("breadcrumb", () => {
  const nested: NavNode[] = [
    {
      label: "guide",
      children: [
        {
          label: "orders",
          sitePath: "guide/orders/index.html",
          children: [{ label: "payables", sitePath: "guide/orders/payables.html", children: [] }],
        },
      ],
    },
  ];

  it("renders the ancestor trail for a nested page", () => {
    const html = renderPage(page({ sitePath: "guide/orders/payables.html" }), nested, {
      siteTitle: "Docs",
    });
    expect(html).toContain('<nav class="canopy-breadcrumb" aria-label="Breadcrumb">');
    expect(html).toContain("<li>guide</li>");
    expect(html).toContain('<li><a href="index.html">orders</a></li>');
    expect(html).toContain("<li>payables</li>");
  });

  it("omits the breadcrumb for a top-level page — a one-entry trail says nothing the <h1> doesn't", () => {
    // "Home" (outer `nav` fixture) sits at the tree's own top level: its
    // ancestor chain is itself alone.
    const html = renderPage(page({ sitePath: "index.html" }), nav, { siteTitle: "Docs" });
    expect(html).not.toContain("canopy-breadcrumb");
  });

  it("omits the breadcrumb for a page the tree doesn't place at all", () => {
    const html = renderPage(page({ sitePath: "unplaced.html" }), nested, { siteTitle: "Docs" });
    expect(html).not.toContain("canopy-breadcrumb");
  });

  it("never manufactures a topbar just to hold the breadcrumb, the same guarantee the theme toggle already gets", () => {
    const html = renderPage(page({ sitePath: "guide/orders/payables.html" }), nested);
    expect(html).not.toContain("canopy-topbar");
    expect(html).not.toContain("canopy-breadcrumb");
  });

  it("localizes the breadcrumb's aria-label via strings.breadcrumb", () => {
    const html = renderPage(page({ sitePath: "guide/orders/payables.html" }), nested, {
      siteTitle: "Docs",
      strings: { breadcrumb: "이동 경로" },
    });
    expect(html).toContain('aria-label="이동 경로"');
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

  it("overrides the title and heading via strings.indexTitle", () => {
    const html = renderContentsPage(contentsNav, { strings: { indexTitle: "목차" } });
    expect(html).toContain("<title>목차</title>");
    expect(html).toContain("<h1>목차</h1>");
    expect(html).not.toContain("Contents");
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

  // renderBacklinks, the shell's other strings-labelled aside in the same
  // column, already shows its label as a visible <h2> — the outline had only
  // ever exposed the same label via aria-label, invisible to a sighted
  // reader. The aria-label stays too: a page can carry more than one <nav>
  // landmark, and that is what tells them apart in a screen reader's
  // landmark list, a job the <h2> does not do.
  it("shows the outline's own label as a visible heading, matching renderBacklinks", () => {
    const html = renderPage(page({ outline }), nav);
    expect(html).toContain('<nav class="canopy-outline" aria-label="On this page"><h2>On this page</h2>');
  });

  it("overrides the outline heading via strings.onThisPage, in both the visible heading and the label", () => {
    const html = renderPage(page({ outline }), nav, { strings: { onThisPage: "이 페이지에서" } });
    expect(html).toContain('aria-label="이 페이지에서"><h2>이 페이지에서</h2>');
    expect(html).not.toContain(">On this page<");
  });

  it("omits an outline that would not help", () => {
    expect(renderPage(page({ outline: [] }), nav)).not.toContain("canopy-outline");
    // One entry is not a structure to navigate.
    expect(
      renderPage(page({ outline: [{ level: 2, text: "Only", id: "only" }] }), nav),
    ).not.toContain("canopy-outline");
  });

  it("places the outline after the article, not before it", () => {
    // A narrow viewport (no room for the beside-the-text grid) falls back to
    // plain document flow, and flow order is markup order — the same order
    // assistive tech reads regardless of viewport. A reader arriving on a
    // narrow screen must reach the article before a list of its own
    // headings, not the other way around.
    const html = renderPage(page({ outline }), nav);
    const contentAt = html.indexOf('<article class="canopy-content">');
    const outlineAt = html.indexOf('<nav class="canopy-outline"');
    expect(contentAt).toBeGreaterThan(-1);
    expect(outlineAt).toBeGreaterThan(contentAt);
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

describe("head metadata", () => {
  const head = (html: string): string => html.slice(0, html.indexOf("</head>"));

  it("prefers a page's own frontmatter description over the site's", () => {
    const html = renderPage(page({ frontmatter: { description: "About this page" } }), nav, {
      description: "About the site",
    });
    expect(head(html)).toContain('<meta name="description" content="About this page">');
    expect(head(html)).toContain('<meta property="og:description" content="About this page">');
    expect(head(html)).not.toContain("About the site");
  });

  it("falls back to the site description when the page has none, or a blank one", () => {
    for (const frontmatter of [{}, { description: "  " }, { description: 42 }]) {
      const html = renderPage(page({ frontmatter }), nav, { description: "About the site" });
      expect(head(html)).toContain('<meta name="description" content="About the site">');
    }
  });

  it("writes no description tag at all when neither the page nor the site has one", () => {
    const html = renderPage(page(), nav);
    expect(head(html)).not.toContain('name="description"');
    expect(head(html)).not.toContain("og:description");
  });

  it("always writes the Open Graph basics, which need nothing absolute", () => {
    const html = renderPage(page(), nav, { siteTitle: "Notes" });
    expect(head(html)).toContain('<meta property="og:title" content="idea">');
    expect(head(html)).toContain('<meta property="og:type" content="article">');
    expect(head(html)).toContain('<meta property="og:site_name" content="Notes">');
    expect(head(html)).toContain('<meta name="twitter:card" content="summary">');
  });

  it("types the site's front page as a website, every other page as an article", () => {
    const front = renderPage(page({ sitePath: "index.html" }), nav);
    expect(head(front)).toContain('<meta property="og:type" content="website">');
    expect(head(renderContentsPage(nav))).toContain('<meta property="og:type" content="website">');
  });

  it("writes no absolute URL into the head without a site URL, so the output stays portable", () => {
    const html = renderPage(page(), nav, {
      siteTitle: "Notes",
      description: "d",
      imagePath: "assets/cover.png",
      alternates: { ko: "https://example.test/ko" },
    });
    expect(head(html)).not.toMatch(/https?:\/\//);
    expect(head(html)).not.toContain('rel="canonical"');
    expect(head(html)).not.toContain("og:url");
    expect(head(html)).not.toContain("og:image");
    expect(head(html)).not.toContain("hreflang");
  });

  it("names the page's canonical URL from the site URL, folding an index page into its directory", () => {
    const html = renderPage(page(), nav, { siteUrl: "https://example.test/help/" });
    expect(head(html)).toContain('<link rel="canonical" href="https://example.test/help/notes/idea.html">');
    expect(head(html)).toContain('<meta property="og:url" content="https://example.test/help/notes/idea.html">');
    const index = renderPage(page({ sitePath: "notes/index.html" }), nav, {
      siteUrl: "https://example.test/help",
    });
    expect(head(index)).toContain('<link rel="canonical" href="https://example.test/help/notes/">');
  });

  it("keeps every body link relative even when the head carries absolute URLs", () => {
    const html = renderPage(page(), nav, { siteUrl: "https://example.test/help" });
    const body = html.slice(html.indexOf("<body>"));
    expect(body).not.toContain("https://example.test");
    expect(body).toContain('href="../index.html"');
  });

  describe("preview image", () => {
    it("resolves the site's default image to an absolute URL and makes the card large", () => {
      const html = renderPage(page(), nav, {
        siteUrl: "https://example.test",
        imagePath: "assets/cover image.png",
      });
      expect(head(html)).toContain(
        '<meta property="og:image" content="https://example.test/assets/cover%20image.png">',
      );
      expect(head(html)).toContain('<meta name="twitter:card" content="summary_large_image">');
    });

    it("lets a page's own frontmatter image win over the site's default", () => {
      const html = renderPage(page({ frontmatter: { image: "assets/idea.png" } }), nav, {
        siteUrl: "https://example.test",
        imagePath: "assets/cover.png",
      });
      expect(head(html)).toContain('content="https://example.test/assets/idea.png"');
      expect(head(html)).not.toContain("cover.png");
    });

    it("uses an absolute image URL as given, with or without a site URL", () => {
      const html = renderPage(page({ frontmatter: { image: "https://cdn.test/idea.png" } }), nav);
      expect(head(html)).toContain('<meta property="og:image" content="https://cdn.test/idea.png">');
    });
  });

  describe("language editions", () => {
    it("lists each edition's counterpart of this page, the site's own language first", () => {
      const html = renderPage(page(), nav, {
        lang: "en",
        siteUrl: "https://example.test/help",
        alternates: { ko: "https://example.test/ko/help/", "x-default": "https://example.test/help" },
      });
      const links = head(html).match(/<link rel="alternate"[^>]*>/g) ?? [];
      expect(links).toEqual([
        '<link rel="alternate" hreflang="en" href="https://example.test/help/notes/idea.html">',
        '<link rel="alternate" hreflang="ko" href="https://example.test/ko/help/notes/idea.html">',
        '<link rel="alternate" hreflang="x-default" href="https://example.test/help/notes/idea.html">',
      ]);
    });

    it("does not add a second self entry when the map already places the site's own language", () => {
      const html = renderPage(page(), nav, {
        lang: "ko",
        siteUrl: "https://example.test/ko",
        alternates: { en: "https://example.test/en", ko: "https://example.test/ko" },
      });
      const links = head(html).match(/hreflang="ko"/g) ?? [];
      expect(links).toHaveLength(1);
    });

    it("folds index pages in every edition's URL, the same way the canonical does", () => {
      const html = renderPage(page({ sitePath: "guide/index.html" }), nav, {
        siteUrl: "https://example.test",
        alternates: { ko: "https://example.test/ko" },
      });
      expect(head(html)).toContain('hreflang="ko" href="https://example.test/ko/guide/"');
    });
  });

  it("escapes what it writes into attributes", () => {
    const html = renderPage(page({ frontmatter: { description: 'a "quoted" <tag>' } }), nav);
    expect(head(html)).toContain('content="a &quot;quoted&quot; &lt;tag&gt;"');
  });
});

describe("head metadata: a regional site language beside a plain-language edition", () => {
  it("lists both ko-KR (this site) and ko (the map's) — different hreflang tags, not a duplicate", () => {
    // `lang` and an alternate key are compared as written: "ko-KR" and "ko"
    // are two tags to a crawler, and a site that really has both editions
    // must name both. Collapsing them would silently drop one.
    const html = renderPage(page(), nav, {
      lang: "ko-KR",
      siteUrl: "https://example.test/kr",
      alternates: { ko: "https://example.test/ko" },
    });
    const head = html.slice(0, html.indexOf("</head>"));
    expect(head).toContain('hreflang="ko-KR" href="https://example.test/kr/notes/idea.html"');
    expect(head).toContain('hreflang="ko" href="https://example.test/ko/notes/idea.html"');
  });
});
