import { describe, expect, it } from "vitest";
import { build } from "./index.js";

describe("build", () => {
  it("maps each source document to a rendered page", async () => {
    const bundle = await build({
      documents: [
        { path: "index.md", content: "---\ntitle: Home\n---\n# Home" },
        { path: "notes/idea.md", content: "# Idea" },
      ],
    });
    expect(bundle.pages.map((p) => p.sitePath)).toEqual([
      "index.html",
      "notes/idea.html",
    ]);
    expect(bundle.pages[0]?.frontmatter).toEqual({ title: "Home" });
    expect(bundle.pages[0]?.html).toContain('<h1 id="home">Home</h1>');
    expect(bundle.pages[1]?.html).toContain('<h1 id="idea">Idea</h1>');
  });

  it("derives a navigation tree from the rendered pages", async () => {
    const bundle = await build({
      documents: [
        { path: "index.md", content: "---\ntitle: Home\n---\n# Home" },
        { path: "notes/idea.md", content: "# Idea" },
      ],
    });
    expect(bundle.navigation).toEqual([
      { label: "notes", children: [{ label: "Idea", sitePath: "notes/idea.html", children: [] }] },
      { label: "Home", sitePath: "index.html", children: [] },
    ]);
  });

  // The name a document gives itself, reaching every place that name is shown.
  describe("names pages from the heading they open with", () => {
    it("labels navigation with the h1 instead of the filename", async () => {
      const bundle = await build({
        documents: [
          { path: "order/list.md", content: "# 주문 목록" },
          { path: "order/detail.md", content: "# 주문 상세" },
        ],
      });
      // Sorted by the name the reader sees, not by the filename behind it —
      // "목록" before "상세", which the stems ("detail", "list") would reverse.
      expect(bundle.navigation).toEqual([
        {
          label: "order",
          children: [
            { label: "주문 목록", sitePath: "order/list.html", children: [] },
            { label: "주문 상세", sitePath: "order/detail.html", children: [] },
          ],
        },
      ]);
    });

    it("carries the h1 into backlink text", async () => {
      const bundle = await build({
        documents: [
          { path: "a.md", content: "# 주문 목록\n\nSee [[b]]." },
          { path: "b.md", content: "# 주문 상세" },
        ],
      });
      expect(bundle.pages.find((p) => p.sitePath === "b.html")?.backlinks).toEqual([
        { sitePath: "a.html", title: "주문 목록" },
      ]);
    });

    it("lets a folder's index page name the folder it opens", async () => {
      // Otherwise the sidebar would read "order" while the tab of the very same
      // page reads "주문", which is the renderer disagreeing with itself.
      const bundle = await build({
        documents: [
          { path: "order/index.md", content: "# 주문" },
          { path: "order/list.md", content: "# 주문 목록" },
        ],
      });
      expect(bundle.navigation).toEqual([
        {
          label: "주문",
          sitePath: "order/index.html",
          children: [{ label: "주문 목록", sitePath: "order/list.html", children: [] }],
        },
      ]);
    });

    it("keeps the filename when a document names itself nowhere", async () => {
      const bundle = await build({
        documents: [{ path: "notes/scratch.md", content: "Just prose, no heading." }],
      });
      expect(bundle.navigation).toEqual([
        {
          label: "notes",
          children: [{ label: "scratch", sitePath: "notes/scratch.html", children: [] }],
        },
      ]);
    });

    it("lets a nav spec's own label override the h1", async () => {
      const bundle = await build({
        documents: [{ path: "order/list.md", content: "# 주문 목록" }],
        nav: { items: [{ label: "Orders", path: "order/list" }] },
      });
      expect(bundle.navigation).toEqual([
        { label: "Orders", sitePath: "order/list.html", children: [] },
      ]);
    });

    it("fills an unlabeled nav spec entry with the h1", async () => {
      const bundle = await build({
        documents: [{ path: "order/list.md", content: "# 주문 목록" }],
        nav: { items: [{ path: "order/list" }] },
      });
      expect(bundle.navigation).toEqual([
        { label: "주문 목록", sitePath: "order/list.html", children: [] },
      ]);
    });
  });

  it("resolves wikilinks to relative hrefs and records backlinks", async () => {
    const bundle = await build({
      documents: [
        { path: "notes/idea.md", content: "See [[plan]]." },
        { path: "notes/plan.md", content: "---\ntitle: The Plan\n---\n# Plan" },
      ],
    });
    const idea = bundle.pages.find((p) => p.sitePath === "notes/idea.html");
    const plan = bundle.pages.find((p) => p.sitePath === "notes/plan.html");
    // Sibling link is relative (not root-absolute).
    expect(idea?.html).toContain('href="plan.html"');
    // The plan page is linked from idea -> one backlink, carrying its title.
    expect(plan?.backlinks).toEqual([
      { sitePath: "notes/idea.html", title: undefined },
    ]);
    // idea has no inbound links.
    expect(idea?.backlinks).toEqual([]);
  });

  it("renders an unresolved wikilink as plain text, not a link", async () => {
    const bundle = await build({
      documents: [{ path: "a.md", content: "Link to [[ghost]] here." }],
    });
    expect(bundle.pages[0]?.html).toContain("ghost");
    expect(bundle.pages[0]?.html).not.toContain("<a");
  });

  it("supports alias and heading wikilinks", async () => {
    const bundle = await build({
      documents: [
        { path: "idea.md", content: "[[plan#Next Steps|the plan]]" },
        { path: "plan.md", content: "## Next Steps" },
      ],
    });
    const html = bundle.pages[0]?.html ?? "";
    expect(html).toContain('href="plan.html#next-steps"');
    expect(html).toContain(">the plan</a>");
  });

  it("is deterministic for the same input (stateless build)", async () => {
    const input = { documents: [{ path: "a.md", content: "x [[a]]" }] };
    expect(await build(input)).toEqual(await build(input));
  });

  it("resolves a markdown link and a wikilink to the same target identically", async () => {
    const bundle = await build({
      documents: [
        { path: "a.md", content: "[markdown](b.md) and [[b]]" },
        { path: "b.md", content: "# B" },
      ],
    });
    const hrefs = [...(bundle.pages[0]?.html ?? "").matchAll(/href="([^"]*)"/g)].map(
      (m) => m[1],
    );
    // The two syntaxes are two ways of writing the same link, so they must not
    // disagree: before markdown links were rewritten this was ["b.md", "b.html"].
    expect(hrefs).toEqual(["b.html", "b.html"]);
  });

  it("counts markdown links as references in the backlink graph", async () => {
    const bundle = await build({
      documents: [
        { path: "wiki.md", content: "---\ntitle: Wiki\n---\n[[target]]" },
        { path: "md.md", content: "---\ntitle: Md\n---\n[go](target.md)" },
        { path: "ref.md", content: "---\ntitle: Ref\n---\n[go][t]\n\n[t]: target.md" },
        { path: "target.md", content: "# Target" },
      ],
    });
    const target = bundle.pages.find((p) => p.sitePath === "target.html");
    // A link is a reference regardless of which syntax expressed it — including
    // the reference-style form, whose url lives on a definition node.
    expect(target?.backlinks.map((b) => b.sitePath)).toEqual([
      "md.html",
      "ref.html",
      "wiki.html",
    ]);
  });

  it("leaves links that point outside the vault untouched", async () => {
    const bundle = await build({
      documents: [
        {
          path: "guide/a.md",
          content:
            "[ext](https://example.com/x.md) [abs](/help/x.md) [frag](#top) [mail](mailto:a@b.c)",
        },
      ],
    });
    const hrefs = [...(bundle.pages[0]?.html ?? "").matchAll(/href="([^"]*)"/g)].map(
      (m) => m[1],
    );
    expect(hrefs).toEqual([
      "https://example.com/x.md",
      "/help/x.md",
      "#top",
      "mailto:a@b.c",
    ]);
  });

  it("keeps a link's fragment when rewriting it", async () => {
    const bundle = await build({
      documents: [
        { path: "a.md", content: "[see](b.md#next-steps)" },
        { path: "b.md", content: "## Next Steps" },
      ],
    });
    expect(bundle.pages[0]?.html).toContain('href="b.html#next-steps"');
  });

  it("carries each page's heading outline, with the ids the page uses", async () => {
    const bundle = await build({
      documents: [
        {
          path: "a.md",
          content: "# Title\n\n## Getting started\n\ntext\n\n### Details\n\n## Next steps\n",
        },
      ],
    });
    const page = bundle.pages[0];
    expect(page?.outline).toEqual([
      { level: 2, text: "Getting started", id: "getting-started" },
      { level: 3, text: "Details", id: "details" },
      { level: 2, text: "Next steps", id: "next-steps" },
    ]);
    // The ids must be the ones already in the body, or the anchors go nowhere —
    // and they are the same ids `[[a#Getting started]]` resolves to.
    for (const item of page?.outline ?? []) {
      expect(page?.html).toContain(`id="${item.id}"`);
    }
  });

  it("uses a navigation spec's order instead of the derived one", async () => {
    const documents = [
      { path: "update-note/2026-04.md", content: "---\ntitle: 2026-04\n---\n# April" },
      { path: "update-note/2026-08.md", content: "---\ntitle: 2026-08\n---\n# August" },
    ];
    const derived = await build({ documents });
    expect(derived.navigation[0]?.children.map((c) => c.label)).toEqual([
      "2026-04",
      "2026-08",
    ]);

    const specified = await build({
      documents,
      nav: {
        items: [
          {
            label: "Release notes",
            items: [{ path: "update-note/2026-08" }, { path: "update-note/2026-04" }],
          },
        ],
      },
    });
    // Newest first, under a display label rather than the directory name.
    expect(specified.navigation).toEqual([
      {
        label: "Release notes",
        children: [
          { label: "2026-08", sitePath: "update-note/2026-08.html", children: [] },
          { label: "2026-04", sitePath: "update-note/2026-04.html", children: [] },
        ],
      },
    ]);
  });

  it("reports pages a navigation spec left out", async () => {
    const bundle = await build({
      documents: [
        { path: "a.md", content: "# A" },
        { path: "b.md", content: "# B" },
      ],
      nav: { items: [{ path: "a.md" }] },
    });
    expect(bundle.navReport?.unplaced).toEqual(["b.html"]);
    expect(bundle.navReport?.missing).toEqual([]);
  });

  it("stays deterministic with a navigation spec", async () => {
    const input = {
      documents: [{ path: "a.md", content: "# A" }],
      nav: { items: [{ path: "a.md" }] },
    };
    expect(await build(input)).toEqual(await build(input));
  });

  it("leaves a markdown link to an unpublished document as written", async () => {
    const bundle = await build({
      documents: [{ path: "a.md", content: "[missing](ghost.md)" }],
    });
    // Same judgment as an unresolved wikilink: do not invent a target. A url that
    // was never published stays visible as written rather than becoming a
    // plausible-looking 404.
    expect(bundle.pages[0]?.html).toContain('href="ghost.md"');
  });
});
