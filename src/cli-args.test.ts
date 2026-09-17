import { describe, expect, it } from "vitest";
import { parseBuildArgs } from "./cli-args.js";

describe("parseBuildArgs", () => {
  it("parses the build command with a vault and the default out dir", () => {
    expect(parseBuildArgs(["build", "myvault"])).toEqual({
      ok: true,
      vault: "myvault",
      out: "site",
      siteTitle: undefined,
      siteDescription: undefined,
      lang: undefined,
      siteIcon: undefined,
      navPath: undefined,
      tokensCssPath: undefined,
      searchIndexPath: undefined,
      scriptPath: undefined,
      exclude: [],
      rehypePluginPaths: [],
    });
  });

  it("parses an explicit out directory", () => {
    expect(parseBuildArgs(["build", "v", "dist"])).toMatchObject({
      ok: true,
      vault: "v",
      out: "dist",
    });
  });

  it("parses --site-title and --tokens-css", () => {
    expect(
      parseBuildArgs([
        "build",
        "v",
        "out",
        "--site-title",
        "My Notes",
        "--tokens-css",
        "/t.css",
      ]),
    ).toMatchObject({
      ok: true,
      vault: "v",
      out: "out",
      siteTitle: "My Notes",
      tokensCssPath: "/t.css",
    });
  });

  it("accepts flags before the optional out positional", () => {
    expect(
      parseBuildArgs(["build", "v", "--site-title", "X"]),
    ).toMatchObject({ ok: true, vault: "v", out: "site", siteTitle: "X" });
  });

  it("parses the document metadata flags", () => {
    expect(
      parseBuildArgs([
        "build",
        "v",
        "--lang",
        "ko-KR",
        "--site-icon",
        "assets/favicon.png",
        "--site-description",
        "Product help",
      ]),
    ).toMatchObject({
      ok: true,
      lang: "ko-KR",
      siteIcon: "assets/favicon.png",
      siteDescription: "Product help",
    });
  });

  it("collects --exclude, which may be repeated", () => {
    expect(
      parseBuildArgs(["build", "v", "--exclude", "drafts/**", "--exclude", "*.tmp"]),
    ).toMatchObject({ ok: true, vault: "v", exclude: ["drafts/**", "*.tmp"] });
  });

  it("rejects a missing vault", () => {
    expect(parseBuildArgs(["build"]).ok).toBe(false);
  });

  it("rejects an unknown command", () => {
    expect(parseBuildArgs(["serve", "v"]).ok).toBe(false);
  });

  it("rejects a flag missing its value", () => {
    const result = parseBuildArgs(["build", "v", "--site-title"]);
    expect(result.ok).toBe(false);
  });

  it("reads the branding flags", () => {
    const args = parseBuildArgs([
      "build", "vault",
      "--site-logo", "assets/logo.svg",
      "--home-url", "https://example.test/",
      "--home-label", "제품 홈",
    ]);
    expect(args).toMatchObject({
      ok: true,
      siteLogo: "assets/logo.svg",
      homeUrl: "https://example.test/",
      homeLabel: "제품 홈",
    });
  });

  it("refuses a home URL with no label, since canopy cannot write the link text", () => {
    const args = parseBuildArgs(["build", "vault", "--home-url", "https://example.test/"]);
    expect(args).toEqual({
      ok: false,
      error: "--home-url needs --home-label: the link text has to be in the site's language",
    });
  });

  it("refuses a home label with no URL", () => {
    const args = parseBuildArgs(["build", "vault", "--home-label", "제품 홈"]);
    expect(args).toEqual({ ok: false, error: "--home-label needs --home-url" });
  });

  // `--lang` only changes what <html lang> declares; the reader chrome's own
  // text (search, theme toggle, nav landmarks) needs a translation supplied
  // separately, the same way `--home-label` supplies text `--home-url` cannot.
  it("parses --strings as a JSON object of chrome text overrides", () => {
    const args = parseBuildArgs([
      "build",
      "vault",
      "--strings",
      '{"search":"검색","toggleTheme":"테마 전환"}',
    ]);
    expect(args).toMatchObject({
      ok: true,
      strings: { search: "검색", toggleTheme: "테마 전환" },
    });
  });

  it("rejects --strings that is not valid JSON", () => {
    const args = parseBuildArgs(["build", "vault", "--strings", "{not json}"]);
    expect(args).toMatchObject({ ok: false });
  });

  it("rejects --strings that is not a JSON object", () => {
    const args = parseBuildArgs(["build", "vault", "--strings", '["search"]']);
    expect(args).toEqual({ ok: false, error: '--strings: must be a JSON object' });
  });

  it("parses --search-index", () => {
    const args = parseBuildArgs(["build", "vault", "--search-index", "search-index.json"]);
    expect(args).toMatchObject({ ok: true, searchIndexPath: "search-index.json" });
  });

  it("parses --script", () => {
    const args = parseBuildArgs(["build", "vault", "--script", "search-ui.js"]);
    expect(args).toMatchObject({ ok: true, scriptPath: "search-ui.js" });
  });

  it("collects --rehype-plugin, which may be repeated", () => {
    expect(
      parseBuildArgs([
        "build",
        "v",
        "--rehype-plugin",
        "rehype-declart",
        "--rehype-plugin",
        "./my-plugin.js",
      ]),
    ).toMatchObject({
      ok: true,
      vault: "v",
      rehypePluginPaths: ["rehype-declart", "./my-plugin.js"],
    });
  });
});

describe("parseBuildArgs: where the site is published", () => {
  it("parses --site-url, --site-image, and repeated --alternate entries", () => {
    const args = parseBuildArgs([
      "build", "v",
      "--site-url", "https://example.test/help/",
      "--site-image", "assets/cover.png",
      "--alternate", "ko=https://example.test/ko/help/",
      "--alternate", "x-default=https://example.test/help/",
    ]);
    expect(args).toMatchObject({
      ok: true,
      siteUrl: "https://example.test/help/",
      siteImage: "assets/cover.png",
      alternates: { ko: "https://example.test/ko/help/", "x-default": "https://example.test/help/" },
    });
  });

  it("leaves alternates undefined when the flag is never given", () => {
    expect(parseBuildArgs(["build", "v"])).toMatchObject({ ok: true, alternates: undefined });
  });

  it("refuses a site URL that is not absolute — the flag exists to be absolute", () => {
    expect(parseBuildArgs(["build", "v", "--site-url", "/help"])).toEqual({
      ok: false,
      error: '--site-url: "/help" must be an absolute http(s) URL',
    });
  });

  it("refuses a preview image without a site URL, rather than silently writing no tag", () => {
    expect(parseBuildArgs(["build", "v", "--site-image", "assets/cover.png"])).toEqual({
      ok: false,
      error: "--site-image needs --site-url: a preview image has to be an absolute URL",
    });
  });

  it("refuses alternates without a site URL, since a page must name its own edition too", () => {
    const args = parseBuildArgs(["build", "v", "--alternate", "ko=https://example.test/ko"]);
    expect(args).toMatchObject({ ok: false });
    expect((args as { error: string }).error).toContain("--alternate needs --site-url");
  });

  it("refuses an alternate that is not <lang>=<url>", () => {
    const base = ["build", "v", "--site-url", "https://example.test"];
    expect(parseBuildArgs([...base, "--alternate", "ko"])).toEqual({
      ok: false,
      error: '--alternate: expected <lang>=<url>, got "ko"',
    });
    expect(parseBuildArgs([...base, "--alternate", "ko=/ko"])).toEqual({
      ok: false,
      error: '--alternate ko: "/ko" must be an absolute http(s) URL',
    });
  });

  it("splits an alternate at the first '=' only, so a URL with a query survives", () => {
    const args = parseBuildArgs([
      "build", "v", "--site-url", "https://example.test",
      "--alternate", "ko=https://example.test/ko?edition=1",
    ]);
    expect(args).toMatchObject({ ok: true, alternates: { ko: "https://example.test/ko?edition=1" } });
  });
});
