import { describe, expect, it } from "vitest";
import { fileUrl, pageUrl, relativeHref, toSitePath } from "./site-path.js";

describe("toSitePath", () => {
  it("maps a markdown file to .html", () => {
    expect(toSitePath("notes/idea.md")).toBe("notes/idea.html");
  });

  it("is case-insensitive on the .md extension", () => {
    expect(toSitePath("README.MD")).toBe("README.html");
  });

  it("normalizes backslashes to POSIX separators", () => {
    expect(toSitePath("notes\\sub\\idea.md")).toBe("notes/sub/idea.html");
  });

  it("strips a leading slash", () => {
    expect(toSitePath("/notes/idea.md")).toBe("notes/idea.html");
  });

  it("leaves non-markdown asset paths unchanged", () => {
    expect(toSitePath("assets/photo.png")).toBe("assets/photo.png");
  });
});

describe("relativeHref", () => {
  it("links a sibling page by filename", () => {
    expect(relativeHref("notes/idea.html", "notes/plan.html")).toBe("plan.html");
  });

  it("ascends out of nested folders", () => {
    expect(relativeHref("notes/sub/deep.html", "notes/idea.html")).toBe("../idea.html");
  });

  it("descends from root into a folder", () => {
    expect(relativeHref("index.html", "notes/idea.html")).toBe("notes/idea.html");
  });

  it("ascends from a folder to root", () => {
    expect(relativeHref("notes/idea.html", "about.html")).toBe("../about.html");
  });

  it("links a page to itself by filename", () => {
    expect(relativeHref("notes/idea.html", "notes/idea.html")).toBe("idea.html");
  });

  it("URL-encodes segments with spaces (valid on static hosts)", () => {
    expect(relativeHref("index.html", "guide/deep dive.html")).toBe(
      "guide/deep%20dive.html",
    );
    expect(relativeHref("guide/deep dive.html", "index.html")).toBe("../index.html");
  });
});

describe("pageUrl", () => {
  it("joins the site URL and the page path", () => {
    expect(pageUrl("https://example.test/help", "guide/install.html")).toBe(
      "https://example.test/help/guide/install.html",
    );
  });

  it("folds an index page into its directory — one page, one URL", () => {
    expect(pageUrl("https://example.test", "index.html")).toBe("https://example.test/");
    expect(pageUrl("https://example.test", "guide/index.html")).toBe("https://example.test/guide/");
  });

  it("tolerates a trailing slash on the site URL, and a leading one on the path", () => {
    expect(pageUrl("https://example.test/help/", "/guide/install.html")).toBe(
      "https://example.test/help/guide/install.html",
    );
  });

  it("percent-encodes what a URL cannot carry raw", () => {
    expect(pageUrl("https://example.test", "error messages.html")).toBe(
      "https://example.test/error%20messages.html",
    );
  });
});

describe("fileUrl", () => {
  it("names a file by its full path, with no index folding", () => {
    expect(fileUrl("https://example.test/help/", "assets/index.html")).toBe(
      "https://example.test/help/assets/index.html",
    );
    expect(fileUrl("https://example.test", "assets/cover image.png")).toBe(
      "https://example.test/assets/cover%20image.png",
    );
  });
});
