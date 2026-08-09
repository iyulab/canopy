/**
 * Pure argument parsing for the `canopy build` command. Kept separate from `cli.ts`
 * (which owns IO) so the contract is unit-testable: positional `<vault> [out]` plus the
 * optional value and list flags documented in `USAGE` below.
 */

export type BuildArgs =
  | {
      ok: true;
      vault: string;
      out: string;
      siteTitle?: string;
      tokensCssPath?: string;
      /** Vault paths to leave unpublished; empty when the flag was not given. */
      exclude: string[];
      /** BCP 47 language tag for the published pages. */
      lang?: string;
      /** Vault-relative path of a favicon to link from every page. */
      siteIcon?: string;
      /** Site description for `<meta name="description">`. */
      siteDescription?: string;
      /** Path to a JSON navigation spec giving the order and labels. */
      navPath?: string;
      /** Vault-relative path of a logo shown beside the site title. */
      siteLogo?: string;
      /** URL of the site this documentation sits beside. */
      homeUrl?: string;
      /** Link text for `homeUrl`, in the site's own language. */
      homeLabel?: string;
      /**
       * Overrides for the reader chrome's own text (search, theme toggle, nav
       * landmarks) — the reader-facing counterpart to `--lang`, which only
       * changes what `<html lang>` declares. Keys left out keep their
       * English default.
       */
      strings?: Record<string, string>;
      /** Output-relative path to write the search index JSON to. */
      searchIndexPath?: string;
      /**
       * Path to a script file to carry into the published site, deferred and
       * linked from every page. Canopy does not read or run it — the caller
       * owns the behavior; canopy only carries the file (see docs/SCOPE.md).
       */
      scriptPath?: string;
      /**
       * Module paths to rehype plugins, loaded and run in the render pipeline
       * at a fixed position (see render.ts): after sanitize, before Shiki.
       * Unlike --script, canopy imports and runs these — the trust boundary
       * is the same one a build tool's config file already crosses (a
       * caller's own plugin list), not a new one for canopy specifically.
       * Empty when the flag was not given.
       */
      rehypePluginPaths: string[];
    }
  | { ok: false; error: string };

export const USAGE = [
  "Usage: canopy build <vault-dir> [out-dir] [options]",
  "",
  "  --site-title <title>       Site name (defaults to the vault folder name)",
  "  --site-description <text>  Description for <meta name=description>",
  "  --lang <tag>               BCP 47 language tag (defaults to en)",
  "  --site-icon <path>         Vault-relative favicon, linked from every page",
  "  --nav <path>               JSON navigation spec: order and labels",
  "  --tokens-css <path>        Design tokens appended after canopy's defaults",
  "  --site-logo <path>         Vault-relative logo, shown beside the site title",
  "  --home-url <url>           Link back to the site this one sits beside",
  "  --home-label <text>        Link text for --home-url (required with it)",
  "  --strings <json>           JSON object overriding the reader chrome's own text",
  "  --search-index <path>      Write a search index JSON file at this output-relative path",
  "  --script <path>            Carry this script into assets/ and link it, deferred, from every page",
  "  --rehype-plugin <path>     Load a rehype plugin module, run after sanitize and before Shiki (repeatable)",
  "  --exclude <pattern>        Leave a vault path unpublished (repeatable)",
].join("\n");

/**
 * Flags that take a value, and where each one's value lands.
 *
 * A table rather than a branch per flag: adding an option should mean adding a
 * row here and its line to USAGE, not editing a chain that silently falls
 * through to whichever branch is last.
 */
const VALUE_FLAGS = {
  "--site-title": "siteTitle",
  "--site-description": "siteDescription",
  "--lang": "lang",
  "--site-icon": "siteIcon",
  "--nav": "navPath",
  "--tokens-css": "tokensCssPath",
  "--site-logo": "siteLogo",
  "--home-url": "homeUrl",
  "--home-label": "homeLabel",
  "--strings": "stringsJson",
  "--search-index": "searchIndexPath",
  "--script": "scriptPath",
} as const;

/**
 * Repeatable flags collect every occurrence. Repeating beats a delimiter, which
 * would collide with the path characters these values contain.
 */
const LIST_FLAGS = {
  "--exclude": "exclude",
  "--rehype-plugin": "rehypePluginPaths",
} as const;

function isValueFlag(arg: string): arg is keyof typeof VALUE_FLAGS {
  return arg in VALUE_FLAGS;
}

function isListFlag(arg: string): arg is keyof typeof LIST_FLAGS {
  return arg in LIST_FLAGS;
}

export function parseBuildArgs(argv: string[]): BuildArgs {
  const [command, ...rest] = argv;
  if (command !== "build") {
    return { ok: false, error: USAGE };
  }

  const positional: string[] = [];
  const single: Partial<Record<(typeof VALUE_FLAGS)[keyof typeof VALUE_FLAGS], string>> =
    {};
  const exclude: string[] = [];
  const rehypePluginPaths: string[] = [];
  const lists = { exclude, rehypePluginPaths } as const satisfies Record<
    (typeof LIST_FLAGS)[keyof typeof LIST_FLAGS],
    string[]
  >;

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === undefined) {
      continue; // unreachable within the loop bound; narrows away noUncheckedIndexedAccess
    }
    if (isValueFlag(arg) || isListFlag(arg)) {
      const value = rest[i + 1];
      if (value === undefined) {
        return { ok: false, error: `${arg} requires a value` };
      }
      if (isListFlag(arg)) {
        lists[LIST_FLAGS[arg]].push(value);
      } else {
        single[VALUE_FLAGS[arg]] = value;
      }
      i++;
    } else {
      positional.push(arg);
    }
  }

  const vault = positional[0];
  if (vault === undefined) {
    return { ok: false, error: USAGE };
  }

  // Two halves of one thing. Accepting either alone would render a link with no
  // text, or text that links nowhere — both look like canopy losing an argument.
  if (single.homeUrl !== undefined && single.homeLabel === undefined) {
    return {
      ok: false,
      error: "--home-url needs --home-label: the link text has to be in the site's language",
    };
  }
  if (single.homeLabel !== undefined && single.homeUrl === undefined) {
    return { ok: false, error: "--home-label needs --home-url" };
  }

  let strings: Record<string, string> | undefined;
  if (single.stringsJson !== undefined) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(single.stringsJson);
    } catch {
      return { ok: false, error: "--strings: must be valid JSON" };
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ok: false, error: "--strings: must be a JSON object" };
    }
    strings = parsed as Record<string, string>;
  }

  return {
    ok: true,
    vault,
    out: positional[1] ?? "site",
    siteTitle: single.siteTitle,
    siteDescription: single.siteDescription,
    lang: single.lang,
    siteIcon: single.siteIcon,
    navPath: single.navPath,
    tokensCssPath: single.tokensCssPath,
    siteLogo: single.siteLogo,
    homeUrl: single.homeUrl,
    homeLabel: single.homeLabel,
    strings,
    searchIndexPath: single.searchIndexPath,
    scriptPath: single.scriptPath,
    rehypePluginPaths,
    exclude,
  };
}
