import { describe, expect, it } from "vitest";
import {
  featuredProblems,
  type Layout,
  LayoutError,
  layoutFragments,
  parseLayout,
  resolvePageLayout,
  streamDirs,
  streamIndexPath,
  streamListingPage,
  streamPagePaths,
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
    ['{"default":{"pageSize":3}}', /default.pageSize: only a stream folder's listing is paged/],
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

describe("a stream's listing in pages", () => {
  const posts = (dir: string, n: number) => Array.from({ length: n }, (_, i) => `${dir}/p${i + 1}.html`);

  it("takes a pageSize on a stream rule, and refuses one that is not a positive whole number or not on a stream", () => {
    expect(parseLayout('{"dirs":{"blog":{"profile":"stream","pageSize":5}}}').dirs?.blog?.pageSize).toBe(5);
    for (const size of ["0", "-1", "2.5", '"10"']) {
      expect(() => parseLayout(`{"dirs":{"blog":{"profile":"stream","pageSize":${size}}}}`)).toThrow(
        "dirs.blog.pageSize: must be a whole number of at least 1",
      );
    }
    expect(() => parseLayout('{"dirs":{"guide":{"pageSize":5}}}')).toThrow(
      'dirs.guide.pageSize: only a stream folder\'s listing is paged — this rule needs "profile": "stream"',
    );
  });

  it("names a page for every pageSize posts past the first, ten to a page unless the rule says otherwise", () => {
    const layout: Layout = { dirs: { blog: { profile: "stream" } } };
    expect(streamPagePaths(layout, ["blog/index.html", ...posts("blog", 10)])).toEqual([]);
    expect(streamPagePaths(layout, ["blog/index.html", ...posts("blog", 21)])).toEqual([
      "blog/page/2.html",
      "blog/page/3.html",
    ]);
    const small: Layout = { dirs: { Blog: { profile: "stream", pageSize: 2 } } };
    // In the folder's own spelling, like the index page.
    expect(streamPagePaths(small, posts("blog", 5))).toEqual(["blog/page/2.html", "blog/page/3.html"]);
  });

  it("takes a stream's featured posts by vault path, and refuses what cannot be one", () => {
    expect(parseLayout('{"dirs":{"blog":{"profile":"stream","featured":["./blog/Welcome.md"]}}}').dirs?.blog?.featured).toEqual([
      "blog/Welcome.md",
    ]);
    expect(() => parseLayout('{"dirs":{"guide":{"featured":["guide/a.md"]}}}')).toThrow(
      'dirs.guide.featured: only a stream folder has posts to feature — this rule needs "profile": "stream"',
    );
    expect(() => parseLayout('{"dirs":{"blog":{"profile":"stream","featured":"blog/a.md"}}}')).toThrow(
      "dirs.blog.featured: expected a list of the posts' vault paths",
    );
    expect(() => parseLayout('{"dirs":{"blog":{"profile":"stream","featured":["blog/cover.png"]}}}')).toThrow(
      'dirs.blog.featured[0]: "blog/cover.png" is not a markdown post',
    );
    expect(() => parseLayout('{"dirs":{"blog":{"profile":"stream","featured":["../a.md"]}}}')).toThrow(
      'dirs.blog.featured[0]: "../a.md" must not contain ".."',
    );
  });

  it("leaves featured posts out of the dated pages", () => {
    const layout: Layout = { dirs: { blog: { profile: "stream", pageSize: 2, featured: ["blog/P1.md", "blog/p2.md"] } } };
    expect(streamPagePaths(layout, posts("blog", 6))).toEqual(["blog/page/2.html"]);
  });

  it("names a featured entry that is no post of its stream", () => {
    const layout: Layout = {
      dirs: { blog: { profile: "stream", featured: ["blog/a.md", "blog/gone.md", "guide/x.md", "blog/index.md"] } },
    };
    expect(featuredProblems(layout, ["blog/A.md", "blog/index.md", "guide/x.md"])).toEqual([
      'dirs.blog.featured: "blog/gone.md" is not a page this site publishes',
      'dirs.blog.featured: "guide/x.md" is not a post of this stream',
      'dirs.blog.featured: "blog/index.md" is not a post of this stream',
    ]);
  });

  it("pages a whole-site stream from the root", () => {
    const layout: Layout = { default: { profile: "stream", pageSize: 1 } };
    expect(streamPagePaths(layout, ["index.html", "a.html", "b.html"])).toEqual(["page/2.html"]);
  });

  it("says which page of a stream's listing a path is", () => {
    const layout = resolvePageLayout({ dirs: { blog: { profile: "stream" } } }, "blog/page/3.html");
    expect(streamListingPage("blog/index.html", layout)).toBe(1);
    expect(streamListingPage("blog/page/3.html", layout)).toBe(3);
    expect(streamListingPage("blog/post.html", layout)).toBeUndefined();
    expect(streamListingPage("blog/page/1.html", layout)).toBeUndefined();
    expect(streamListingPage("blog/page/x.html", layout)).toBeUndefined();
    expect(streamListingPage("guide/index.html", resolvePageLayout(undefined, "guide/index.html"))).toBeUndefined();
  });
});
