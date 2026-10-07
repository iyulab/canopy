import { describe, expect, it } from "vitest";
import {
  type Layout,
  LayoutError,
  layoutFragments,
  parseLayout,
  resolvePageLayout,
  streamDirs,
  streamIndexPath,
  syntheticIndexPaths,
} from "./layout.js";

describe("parseLayout", () => {
  it("reads a site default and per-folder rules, normalizing folders and fragment paths", () => {
    const json = JSON.stringify({
      default: { regions: { footer: "./partials/footer.html" } },
      dirs: {
        "blog/": {
          profile: "stream",
          title: "Blog",
          regions: { afterArticle: "partials\\cta.html", footer: "" },
        },
      },
    });
    expect(parseLayout(json)).toEqual({
      default: { regions: { footer: "partials/footer.html" } },
      dirs: {
        blog: {
          profile: "stream",
          title: "Blog",
          regions: { afterArticle: "partials/cta.html", footer: "" },
        },
      },
    });
  });

  it.each([
    ['{"default":{"profile":"garden"}}', /default\.profile: must be one of manual, stream/],
    ['{"default":{"regions":{"sidebar":"x.html"}}}', /unknown region "sidebar"/],
    ['{"dirs":{"blog":{"regions":{"header":3}}}}', /dirs\.blog\.regions\.header: must be a vault path/],
    ['{"dirs":{"":{}}}', /names the whole site/],
    ['{"dirs":{"/":{}}}', /names the whole site/],
    ['{"dirs":{"blog/../x":{}}}', /dirs: "blog\/\.\.\/x" .*"\.\."/],
    ['{"default":{"regions":{"header":"../h.html"}}}', /default\.regions\.header: .*"\.\."/],
    ['{"dirs":{"blog":{"regions":{"footer":"a/../../f.html"}}}}', /dirs\.blog\.regions\.footer: .*"\.\."/],
    ['{"default":{"regions":{"header":"/"}}}', /default\.regions\.header: .*names no file/],
    ['{"default":{"regions":{"header":"./"}}}', /default\.regions\.header: .*names no file/],
    ['{"default":{"regions":{"header":"parts/*.html"}}}', /default\.regions\.header: .*\* \? \[ \]/],
    ['{"default":{"regions":{"header":"parts/h[1].html"}}}', /default\.regions\.header: .*\* \? \[ \]/],
    ['{"default":{"regions":{"header":"what?.html"}}}', /default\.regions\.header: .*\* \? \[ \]/],
    ['{"dirs":{"blog":{},"blog/":{}}}', /"blog\/" is given twice/],
    ['{"dirs":{"blog":{},"Blog":{}}}', /"Blog" is given twice/],
    ['[]', /expected an object with "default" and\/or "dirs"/],
    ['{"dirs":[]}', /"dirs": expected an object of folder → rule/],
    ['{"default":"stream"}', /default: expected an object/],
    ['{"dirs":{"blog":{"regions":["h.html"]}}}', /dirs\.blog\.regions: expected an object of region → fragment path/],
    ['{"defaults":{}}', /unknown key "defaults"/],
    ['{"default":{"pageSize":3}}', /default: unknown key "pageSize"/],
    ['{"default":{"title":""}}', /default\.title: must be a non-empty string/],
    ["[", /not valid JSON/],
  ])("rejects %s", (json, message) => {
    expect(() => parseLayout(json)).toThrow(LayoutError);
    expect(() => parseLayout(json)).toThrow(message);
  });
});

describe("resolvePageLayout", () => {
  const layout: Layout = {
    default: { regions: { header: "h.html", footer: "f.html" } },
    dirs: {
      blog: { profile: "stream", regions: { afterArticle: "cta.html", footer: "" } },
      "blog/archive": { profile: "manual" },
    },
  };

  it("is manual with no regions when there is no layout", () => {
    expect(resolvePageLayout(undefined, "guide/a.html")).toEqual({
      profile: "manual",
      streamDir: undefined,
      regions: {},
    });
  });

  it("lets the longest folder decide the profile, and merges regions key by key", () => {
    expect(resolvePageLayout(layout, "blog/post.html")).toEqual({
      profile: "stream",
      streamDir: "blog",
      regions: { header: "h.html", afterArticle: "cta.html" },
    });
    expect(resolvePageLayout(layout, "blog/archive/old.html")).toEqual({
      profile: "manual",
      streamDir: undefined,
      regions: { header: "h.html", afterArticle: "cta.html" },
    });
    expect(resolvePageLayout(layout, "guide/a.html")).toEqual({
      profile: "manual",
      streamDir: undefined,
      regions: { header: "h.html", footer: "f.html" },
    });
  });

  it("places a folder's own index page inside the folder, matching case-insensitively", () => {
    expect(resolvePageLayout(layout, "Blog/index.html").streamDir).toBe("Blog");
    expect(resolvePageLayout(layout, "blogroll.html").profile).toBe("manual");
  });

  it("makes the whole site one stream when the default is stream", () => {
    expect(resolvePageLayout({ default: { profile: "stream" } }, "a/b.html").streamDir).toBe("");
  });
});

describe("stream folders", () => {
  const layout: Layout = {
    default: { profile: "stream" },
    dirs: { news: { profile: "stream" }, docs: { profile: "manual" } },
  };

  it("lists the folders whose own rule is stream", () => {
    expect(streamDirs(layout)).toEqual(["", "news"]);
    expect(streamDirs(undefined)).toEqual([]);
  });

  it("names a stream folder's index page", () => {
    expect(streamIndexPath("")).toBe("index.html");
    expect(streamIndexPath("news")).toBe("news/index.html");
  });

  it("names only the index pages a build does not already have", () => {
    expect(syntheticIndexPaths(layout, ["index.html", "news/a.html", "docs/index.html"])).toEqual([
      "news/index.html",
    ]);
    expect(syntheticIndexPaths(layout, ["INDEX.html", "news/Index.html"])).toEqual([]);
  });

  // A folder is matched ignoring case, so a rule written "News" covers news/;
  // a path canopy writes for it is in the folder's own case, or it would lead
  // nowhere on a host that tells the two apart.
  it("names a stream folder's paths in the folder's own case, not the rule's", () => {
    const shouting: Layout = { dirs: { NEWS: { profile: "stream" } } };
    expect(syntheticIndexPaths(shouting, ["index.html", "news/a.html"])).toEqual(["news/index.html"]);
    expect(syntheticIndexPaths(shouting, ["index.html"])).toEqual(["NEWS/index.html"]);
    expect(resolvePageLayout(shouting, "news/a.html").streamDir).toBe("news");
  });
});

describe("layoutFragments", () => {
  it("names each fragment once, with every region that uses it, and skips regions turned off", () => {
    expect(
      layoutFragments({
        default: { regions: { footer: "f.html", header: "h.html" } },
        dirs: { blog: { regions: { footer: "", afterArticle: "f.html" } } },
      }),
    ).toEqual([
      { path: "f.html", regions: ["afterArticle", "footer"] },
      { path: "h.html", regions: ["header"] },
    ]);
    expect(layoutFragments(undefined)).toEqual([]);
  });
});
