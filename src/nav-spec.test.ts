import { describe, expect, it } from "vitest";
import { parseNavSpec, applyNavSpec, NavSpecError } from "./nav-spec.js";
import type { NavEntry } from "./navigation.js";

describe("parseNavSpec", () => {
  it("parses pages and nested groups", () => {
    const spec = parseNavSpec(
      JSON.stringify({
        items: [
          { path: "index.md" },
          { label: "Guide", items: [{ path: "guide/a.md", label: "First" }] },
        ],
      }),
    );
    expect(spec.items).toEqual([
      { path: "index.md" },
      { label: "Guide", items: [{ path: "guide/a.md", label: "First" }] },
    ]);
  });

  it("rejects malformed specs with a message naming the position", () => {
    const cases: [string, RegExp][] = [
      ["{", /not valid JSON/],
      ["[]", /expected an object/],
      ['{"items": {}}', /"items" must be an array/],
      ['{"items": [{}]}', /items\[0\].*"path".*"items"/],
      ['{"items": [{"items": []}]}', /items\[0\].*group needs a "label"/],
      ['{"items": [{"path": 1}]}', /items\[0\].*"path" must be a string/],
      ['{"items": [{"label": "G", "items": [{}]}]}', /items\[0\] > items\[0\]/],
    ];
    for (const [json, pattern] of cases) {
      expect(() => parseNavSpec(json), json).toThrow(NavSpecError);
      expect(() => parseNavSpec(json), json).toThrow(pattern);
    }
  });
});

describe("applyNavSpec", () => {
  const entries: NavEntry[] = [
    { sitePath: "index.html", title: "Home" },
    { sitePath: "guide/orders.html", title: "Orders" },
    { sitePath: "guide/settings.html", title: "Settings" },
    { sitePath: "update-note/2026-04.html", title: "2026-04" },
    { sitePath: "update-note/2026-08.html", title: "2026-08" },
  ];

  // A spec-driven tree names pages the same way a derived one does. Two answers
  // to "what is this page called" is what the naming ladder exists to prevent,
  // and a spec supplies an order — not a different vocabulary.
  describe("names an unlabeled entry the way the derived tree would", () => {
    const indexed: NavEntry[] = [
      { sitePath: "index.html", title: undefined },
      { sitePath: "guide/index.html", title: undefined },
      { sitePath: "guide/orders.html", title: undefined },
      { sitePath: "설정/index.html", title: "설정" },
    ];

    it("names a folder's index page for the folder, not 'index'", () => {
      const { nodes } = applyNavSpec(
        parseNavSpec(JSON.stringify({ items: [{ path: "guide/index.md" }] })),
        indexed,
      );
      expect(nodes[0]?.label).toBe("guide");
    });

    it("names the root index page for the site's front", () => {
      const { nodes } = applyNavSpec(
        parseNavSpec(JSON.stringify({ items: [{ path: "index.md" }] })),
        indexed,
      );
      expect(nodes[0]?.label).toBe("Home");
    });

    it("prefers the page's own declared name over the folder", () => {
      const { nodes } = applyNavSpec(
        parseNavSpec(JSON.stringify({ items: [{ path: "설정/index.md" }] })),
        indexed,
      );
      expect(nodes[0]?.label).toBe("설정");
    });

    it("still lets the spec's own label win", () => {
      const { nodes } = applyNavSpec(
        parseNavSpec(JSON.stringify({ items: [{ label: "Guide", path: "guide/index.md" }] })),
        indexed,
      );
      expect(nodes[0]?.label).toBe("Guide");
    });

    it("keeps the filename stem for an ordinary unnamed page", () => {
      const { nodes } = applyNavSpec(
        parseNavSpec(JSON.stringify({ items: [{ path: "guide/orders.md" }] })),
        indexed,
      );
      expect(nodes[0]?.label).toBe("orders");
    });
  });

  it("uses the spec's order verbatim, including reverse-chronological", () => {
    const { nodes } = applyNavSpec(
      parseNavSpec(
        JSON.stringify({
          items: [
            {
              label: "업데이트 노트",
              items: [{ path: "update-note/2026-08" }, { path: "update-note/2026-04" }],
            },
          ],
        }),
      ),
      entries,
    );
    // Derived navigation would sort these ascending; the whole point of a spec is
    // that it is not re-sorted.
    expect(nodes[0]?.children.map((c) => c.label)).toEqual(["2026-08", "2026-04"]);
  });

  it("labels a folder group with display text, not its directory name", () => {
    const { nodes } = applyNavSpec(
      parseNavSpec(
        JSON.stringify({
          items: [{ label: "도움말", items: [{ path: "guide/orders.md" }] }],
        }),
      ),
      entries,
    );
    expect(nodes[0]?.label).toBe("도움말");
  });

  it("falls back to the page title, then the filename stem", () => {
    const { nodes } = applyNavSpec(
      parseNavSpec(JSON.stringify({ items: [{ path: "guide/orders.md" }] })),
      entries,
    );
    expect(nodes[0]).toEqual({
      label: "Orders",
      sitePath: "guide/orders.html",
      children: [],
    });

    const untitled: NavEntry[] = [{ sitePath: "guide/orders.html", title: undefined }];
    const { nodes: stemmed } = applyNavSpec(
      parseNavSpec(JSON.stringify({ items: [{ path: "guide/orders" }] })),
      untitled,
    );
    expect(stemmed[0]?.label).toBe("orders");
  });

  it("accepts a path with or without an extension, case-insensitively", () => {
    for (const path of ["guide/orders.md", "guide/orders.html", "guide/orders", "Guide/Orders"]) {
      const { nodes } = applyNavSpec(
        parseNavSpec(JSON.stringify({ items: [{ path }] })),
        entries,
      );
      expect(nodes[0]?.sitePath, path).toBe("guide/orders.html");
    }
  });

  it("lets a group both link a page and hold children", () => {
    const { nodes } = applyNavSpec(
      parseNavSpec(
        JSON.stringify({
          items: [
            { label: "Home", path: "index.md", items: [{ path: "guide/orders.md" }] },
          ],
        }),
      ),
      entries,
    );
    expect(nodes[0]?.sitePath).toBe("index.html");
    expect(nodes[0]?.children).toHaveLength(1);
  });

  it("reports pages the spec never mentioned rather than dropping them silently", () => {
    const { unplaced } = applyNavSpec(
      parseNavSpec(JSON.stringify({ items: [{ path: "index.md" }] })),
      entries,
    );
    expect(unplaced).toEqual([
      "guide/orders.html",
      "guide/settings.html",
      "update-note/2026-04.html",
      "update-note/2026-08.html",
    ]);
  });

  it("reports spec paths that match no page, and omits the dead leaf", () => {
    const { nodes, missing } = applyNavSpec(
      parseNavSpec(
        JSON.stringify({ items: [{ path: "index.md" }, { path: "ghost.md" }] }),
      ),
      entries,
    );
    expect(missing).toEqual(["ghost.md"]);
    // A link to nothing is worse than an absent entry.
    expect(nodes.map((n) => n.sitePath)).toEqual(["index.html"]);
  });

  it("keeps a group whose own page is missing, since its children still resolve", () => {
    const { nodes, missing } = applyNavSpec(
      parseNavSpec(
        JSON.stringify({
          items: [
            { label: "Guide", path: "guide/index.md", items: [{ path: "guide/orders.md" }] },
          ],
        }),
      ),
      entries,
    );
    expect(missing).toEqual(["guide/index.md"]);
    expect(nodes[0]).toMatchObject({ label: "Guide", children: [{ label: "Orders" }] });
    expect(nodes[0]?.sitePath).toBeUndefined();
  });
});
