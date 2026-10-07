import { describe, expect, it } from "vitest";
import { parseBuildArgs, parseListArgs, requestedInfo } from "./cli-args.js";

describe("parseListArgs", () => {
  it("parses a vault with repeated excludes and --json", () => {
    expect(parseListArgs(["list", "v", "--exclude", "drafts", "--json", "--exclude", "*.tmp"])).toEqual({
      ok: true,
      vault: "v",
      exclude: ["drafts", "*.tmp"],
      json: true,
    });
  });

  it("defaults to plain output and no excludes", () => {
    expect(parseListArgs(["list", "v"])).toEqual({ ok: true, vault: "v", exclude: [], json: false });
  });

  it("rejects a build option, a second positional, and a missing vault", () => {
    expect(parseListArgs(["list", "v", "--site-title", "X"])).toMatchObject({
      ok: false,
      error: expect.stringContaining('Unknown option "--site-title" for list'),
    });
    expect(parseListArgs(["list", "v", "out"])).toMatchObject({
      ok: false,
      error: expect.stringContaining('Unexpected argument "out"'),
    });
    expect(parseListArgs(["list"]).ok).toBe(false);
  });

  it("takes a layout file", () => {
    const parsed = parseListArgs(["list", "vault", "--layout", "layout.json", "--json"]);
    expect(parsed).toMatchObject({ ok: true, layoutPath: "layout.json", json: true });
  });

  it("rejects --json on build", () => {
    expect(parseBuildArgs(["build", "v", "--json"]).ok).toBe(false);
  });
});

describe("requestedInfo", () => {
  it("answers --help and -h, alone or after the command", () => {
    expect(requestedInfo(["--help"])).toBe("help");
    expect(requestedInfo(["-h"])).toBe("help");
    expect(requestedInfo(["build", "vault", "--help"])).toBe("help");
  });

  it("answers --version", () => {
    expect(requestedInfo(["--version"])).toBe("version");
  });

  it("prefers help when both are asked for", () => {
    expect(requestedInfo(["--version", "--help"])).toBe("help");
  });

  it("is nothing for an ordinary build", () => {
    expect(requestedInfo(["build", "vault", "--site-title", "X"])).toBeUndefined();
    expect(requestedInfo([])).toBeUndefined();
  });
});

describe("parseBuildArgs", () => {
  it("takes a layout file", () => {
    expect(parseBuildArgs(["build", "vault", "--layout", "layout.json"])).toMatchObject({
      ok: true,
      layoutPath: "layout.json",
    });
  });

  it("rejects an option it does not know instead of taking it as the out dir", () => {
    expect(parseBuildArgs(["build", "v", "--site-titel", "X"])).toMatchObject({
      ok: false,
      error: expect.stringContaining('Unknown option "--site-titel"'),
    });
  });

  it("rejects a third positional argument", () => {
    expect(parseBuildArgs(["build", "v", "dist", "extra"])).toMatchObject({
      ok: false,
      error: expect.stringContaining('Unexpected argument "extra"'),
    });
  });

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
      searchIndexPath: undefined,
      scriptPath: undefined,
      exclude: [],
      rehypePluginPaths: [],
      stylesheetPaths: [],
      siteStylesheets: [],
      feeds: [],
    });
  });

  it("parses an explicit out directory", () => {
    expect(parseBuildArgs(["build", "v", "dist"])).toMatchObject({
      ok: true,
      vault: "v",
      out: "dist",
    });
  });

  it("parses --site-title and repeated --stylesheet, in order", () => {
    expect(
      parseBuildArgs([
        "build",
        "v",
        "out",
        "--site-title",
        "My Notes",
        "--stylesheet",
        "/brand.css",
        "--stylesheet",
        "/layout.css",
      ]),
    ).toMatchObject({
      ok: true,
      vault: "v",
      out: "out",
      siteTitle: "My Notes",
      stylesheetPaths: ["/brand.css", "/layout.css"],
    });
  });

  it("parses repeated --site-stylesheet, in order", () => {
    expect(
      parseBuildArgs(["build", "v", "--site-stylesheet", "brand.css", "--site-stylesheet", "theme/layout.css"]),
    ).toMatchObject({ ok: true, siteStylesheets: ["brand.css", "theme/layout.css"] });
  });

  it("no longer knows --tokens-css, which --stylesheet replaces", () => {
    const parsed = parseBuildArgs(["build", "v", "--tokens-css", "t.css"]);
    expect(parsed.ok).toBe(false);
    expect(parsed.ok ? "" : parsed.error).toContain('Unknown option "--tokens-css"');
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

  it("parses --color-scheme, and refuses anything but light or dark", () => {
    expect(parseBuildArgs(["build", "vault", "--color-scheme", "dark"])).toMatchObject({ ok: true, colorScheme: "dark" });
    expect(parseBuildArgs(["build", "vault"])).not.toHaveProperty("colorScheme");
    expect(parseBuildArgs(["build", "vault", "--color-scheme", "auto"])).toEqual({
      ok: false,
      error: '--color-scheme: expected light or dark, got "auto"',
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

describe("--feed", () => {
  it("collects every folder, and needs --site-url", () => {
    expect(
      parseBuildArgs(["build", "v", "--site-url", "https://e.org", "--feed", "log", "--feed", "."]),
    ).toMatchObject({ ok: true, feeds: ["log", "."] });
    expect(parseBuildArgs(["build", "v", "--feed", "log"])).toEqual({
      ok: false,
      error: "--feed needs --site-url: a feed's entries are absolute URLs",
    });
  });
});
