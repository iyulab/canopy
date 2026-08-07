import { describe, expect, it } from "vitest";
import {
  isExternalUrl,
  parseLinkUrl,
  resolveRelative,
  resolveMarkdownLink,
} from "./markdown-link.js";

describe("isExternalUrl", () => {
  it("treats schemes, protocol-relative, root-absolute, and fragments as external", () => {
    for (const url of [
      "https://example.com",
      "http://example.com",
      "mailto:a@b.c",
      "tel:+123",
      "data:text/plain,x",
      "//cdn.example.com/x.png",
      "/help/assets/x.png",
      "#section",
      "",
    ]) {
      expect(isExternalUrl(url), url).toBe(true);
    }
  });

  it("treats vault-relative paths as internal", () => {
    for (const url of ["notes.md", "./notes.md", "../notes.md", "sub/notes.md"]) {
      expect(isExternalUrl(url), url).toBe(false);
    }
  });

  // A Windows drive letter parses as a scheme, which is the outcome we want:
  // it is not a vault-relative path and must not be rewritten.
  it("does not rewrite absolute Windows paths", () => {
    expect(isExternalUrl("C:/notes/idea.md")).toBe(true);
  });
});

describe("parseLinkUrl", () => {
  it("splits off a fragment or query, keeping it verbatim", () => {
    expect(parseLinkUrl("a.md#heading")).toEqual({ path: "a.md", suffix: "#heading" });
    expect(parseLinkUrl("a.md?v=1")).toEqual({ path: "a.md", suffix: "?v=1" });
    expect(parseLinkUrl("a.md")).toEqual({ path: "a.md", suffix: "" });
  });
});

describe("resolveRelative", () => {
  it("resolves against the linking document's directory", () => {
    expect(resolveRelative("guide/settings/api.html", "diagnostics.md")).toBe(
      "guide/settings/diagnostics.md",
    );
    expect(resolveRelative("guide/settings/api.html", "./diagnostics.md")).toBe(
      "guide/settings/diagnostics.md",
    );
    expect(resolveRelative("guide/settings/api.html", "../orders/list.md")).toBe(
      "guide/orders/list.md",
    );
    expect(resolveRelative("index.html", "guide/a.md")).toBe("guide/a.md");
  });

  it("returns undefined when the path escapes the vault root", () => {
    expect(resolveRelative("index.html", "../outside.md")).toBeUndefined();
    expect(resolveRelative("guide/a.html", "../../outside.md")).toBeUndefined();
  });
});

describe("resolveMarkdownLink", () => {
  const pages = new Set([
    "index.html",
    "guide/settings/api.html",
    "guide/settings/diagnostics.html",
    "guide/orders/list.html",
    "guide/settings/logo.png",
  ]);
  const isPage = (p: string) => pages.has(p);
  const from = "guide/settings/api.html";

  it("rewrites a .md link to its published page", () => {
    expect(resolveMarkdownLink(from, "diagnostics.md", isPage)).toBe(
      "guide/settings/diagnostics.html",
    );
    expect(resolveMarkdownLink(from, "../orders/list.md", isPage)).toBe(
      "guide/orders/list.html",
    );
  });

  it("leaves external and root-absolute URLs untouched", () => {
    for (const url of ["https://example.com/a.md", "/help/x.md", "#top", "mailto:a@b.c"]) {
      expect(resolveMarkdownLink(from, url, isPage), url).toBeUndefined();
    }
  });

  it("leaves a .md link alone when that page was not published", () => {
    // Rewriting would produce a confident-looking URL that 404s; the original
    // at least points at something the author can recognize.
    expect(resolveMarkdownLink(from, "missing.md", isPage)).toBeUndefined();
  });

  it("resolves an extension-less link only when it names a real page", () => {
    expect(resolveMarkdownLink(from, "./diagnostics", isPage)).toBe(
      "guide/settings/diagnostics.html",
    );
    expect(resolveMarkdownLink(from, "./nothing-here", isPage)).toBeUndefined();
  });

  it("passes asset paths through unchanged", () => {
    // Assets are mirrored into the site at the same path, so the resolved path
    // is already correct — and is returned whether or not it was published, since
    // canopy copies assets it was given rather than deciding they are pages.
    expect(resolveMarkdownLink(from, "logo.png", isPage)).toBe("guide/settings/logo.png");
    expect(resolveMarkdownLink(from, "../orders/chart.svg", isPage)).toBe(
      "guide/orders/chart.svg",
    );
  });

  it("leaves a link that escapes the vault untouched", () => {
    expect(resolveMarkdownLink("index.html", "../outside.md", isPage)).toBeUndefined();
  });

  // Editors write the encoded form when a path contains a space, and canopy
  // writes it too — every href it generates is percent-encoded. A target it
  // emits but cannot read back is the renderer contradicting itself.
  describe("percent-encoded targets", () => {
    const encodedPages = new Set([
      "현황 및 통계/daily.html",
      "현황 및 통계/chart.png",
      "a b/target.html",
    ]);
    const hasPage = (p: string) => encodedPages.has(p);

    it("resolves a target whose directory was encoded", () => {
      expect(resolveMarkdownLink("src.html", "a%20b/target.md", hasPage)).toBe(
        "a b/target.html",
      );
    });

    it("resolves the same target written with angle brackets", () => {
      // The two spellings address one file; they must land on one page.
      expect(resolveMarkdownLink("src.html", "a b/target.md", hasPage)).toBe(
        "a b/target.html",
      );
    });

    it("resolves an encoded non-ASCII directory", () => {
      const url = "../%ED%98%84%ED%99%A9%20%EB%B0%8F%20%ED%86%B5%EA%B3%84/daily.md";
      expect(resolveMarkdownLink("guide/api.html", url, hasPage)).toBe(
        "현황 및 통계/daily.html",
      );
    });

    it("resolves an encoded asset path", () => {
      expect(resolveMarkdownLink("guide/api.html", "../%ED%98%84%ED%99%A9%20%EB%B0%8F%20%ED%86%B5%EA%B3%84/chart.png", hasPage)).toBe(
        "현황 및 통계/chart.png",
      );
    });

    it("leaves a malformed escape exactly as written", () => {
      // decodeURIComponent throws on "%zz"; guessing at a repair would invent a
      // target the author never wrote.
      expect(resolveMarkdownLink("src.html", "a%zzb/target.md", hasPage)).toBeUndefined();
    });

    it("does not let an encoded slash become a path separator", () => {
      // "%2F" is a literal slash *inside* a name, not a directory boundary —
      // decoding it into one would address a different file than the author did.
      expect(resolveMarkdownLink("src.html", "a%2Fb/target.md", hasPage)).toBeUndefined();
    });

    it("keeps the fragment untouched", () => {
      expect(resolveMarkdownLink("src.html", "a%20b/target.md#설정", hasPage)).toBe(
        "a b/target.html",
      );
    });
  });
});
