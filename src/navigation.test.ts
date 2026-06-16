import { describe, expect, it } from "vitest";
import { buildNavigation } from "./navigation.js";

describe("buildNavigation", () => {
  it("nests pages under folders derived from their paths", () => {
    const nav = buildNavigation([
      { sitePath: "notes/idea.html" },
      { sitePath: "notes/sub/deep.html" },
      { sitePath: "about.html" },
    ]);
    expect(nav).toEqual([
      {
        label: "notes",
        children: [
          { label: "sub", children: [{ label: "deep", sitePath: "notes/sub/deep.html", children: [] }] },
          { label: "idea", sitePath: "notes/idea.html", children: [] },
        ],
      },
      { label: "about", sitePath: "about.html", children: [] },
    ]);
  });

  it("uses the frontmatter title as the label when present", () => {
    const nav = buildNavigation([{ sitePath: "notes/idea.html", title: "Bright Idea" }]);
    expect(nav[0]?.children[0]?.label).toBe("Bright Idea");
  });

  it("links a folder's index page to the folder node itself", () => {
    const nav = buildNavigation([
      { sitePath: "guide/index.html" },
      { sitePath: "guide/setup.html" },
    ]);
    expect(nav).toEqual([
      {
        label: "guide",
        sitePath: "guide/index.html",
        children: [{ label: "setup", sitePath: "guide/setup.html", children: [] }],
      },
    ]);
  });

  it("labels a root index page as Home", () => {
    const nav = buildNavigation([{ sitePath: "index.html" }]);
    expect(nav).toEqual([{ label: "Home", sitePath: "index.html", children: [] }]);
  });

  it("orders folders before pages, each alphabetically (deterministic)", () => {
    const nav = buildNavigation([
      { sitePath: "zebra.html" },
      { sitePath: "alpha.html" },
      { sitePath: "beta/x.html" },
      { sitePath: "alpha-dir/y.html" },
    ]);
    expect(nav.map((n) => n.label)).toEqual(["alpha-dir", "beta", "alpha", "zebra"]);
  });
});
