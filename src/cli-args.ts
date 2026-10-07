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
      /** Vault paths to leave unpublished; empty when the flag was not given. */
      exclude: string[];
      /** BCP 47 language tag for the published pages. */
      lang?: string;
      /** The one colour scheme a site has, when it has only one. */
      colorScheme?: "light" | "dark";
      /** Vault-relative path of a favicon to link from every page. */
      siteIcon?: string;
      /** Site description for `<meta name="description">`. */
      siteDescription?: string;
      /**
       * Absolute URL the site is published at. Feeds only the `<head>` tags
       * that have to be absolute (canonical, og:url, og:image, hreflang);
       * every link in a page stays relative regardless.
       */
      siteUrl?: string;
      /** Vault-relative path of the image link previews show (`og:image`). */
      siteImage?: string;
      /** Other language editions of the site, `hreflang` → that edition's site URL. */
      alternates?: Record<string, string>;
      /** Vault folders to publish an Atom feed of dated pages for; empty when not given. */
      feeds: string[];
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
      /**
       * Caller stylesheets to carry into assets/ and link after canopy's own,
       * in the order given. Canopy does not read them — the same carrying
       * `--script` does. Empty when the flag was not given.
       */
      stylesheetPaths: string[];
      /**
       * Vault-relative stylesheets the site publishes, linked from every page
       * at their own paths, after everything else — so a relative url()
       * inside one resolves as its author wrote it. Empty when not given.
       */
      siteStylesheets: string[];
      /** JSON layout: each folder's profile and region fragments (see layout.ts). */
      layoutPath?: string;
    }
  | { ok: false; error: string };

export const USAGE = [
  "Usage: canopy build <vault-dir> [out-dir] [options]",
  "       canopy list <vault-dir> [--exclude <pattern>]... [--layout <path>] [--json]",
  "",
  "build publishes the vault as a site; list prints what build would publish, one",
  "vault-relative path per line, without building. list --json prints",
  '{"pages": [...], "assets": [...], "unusedExcludes": [...], "generated": [...]} instead —',
  "generated: the index pages a build writes for stream folders that have none.",
  "",
  "build options:",
  "  --site-title <title>       Site name (defaults to the vault folder name)",
  "  --site-description <text>  Description for <meta name=description>",
  "  --site-url <url>           Absolute URL the site is published at — enables canonical/og:url/og:image/hreflang",
  "  --site-image <path>        Vault-relative image for link previews (og:image); needs --site-url",
  "  --alternate <lang>=<url>   Another language edition of this site, by its own site URL (repeatable); needs --site-url",
  "  --feed <dir>               Atom feed of the dated pages under a vault folder, at <dir>/feed.xml (repeatable; . = whole site); needs --site-url",
  "  --lang <tag>               BCP 47 language tag (defaults to en)",
  "  --color-scheme <light|dark>  The site's one colour scheme, for a site that has only one",
  "  --site-icon <path>         Vault-relative favicon, linked from every page",
  "  --nav <path>               JSON navigation spec: order and labels",
  "  --layout <path>            JSON layout: each folder's profile (manual, stream) and region fragments",
  "  --stylesheet <path>        Carry this CSS into assets/ and link it after canopy's own (repeatable)",
  "  --site-stylesheet <path>   Link a vault-relative stylesheet the site publishes, after all others (repeatable)",
  "  --site-logo <path>         Vault-relative logo, shown beside the site title",
  "  --home-url <url>           Link back to the site this one sits beside",
  "  --home-label <text>        Link text for --home-url (required with it)",
  "  --strings <json>           JSON object overriding the reader chrome's own text",
  "  --search-index <path>      Write a search index JSON file at this output-relative path",
  "  --script <path>            Carry this script into assets/ and link it, deferred, from every page",
  "  --rehype-plugin <path>     Load a rehype plugin module, run after sanitize and before Shiki (repeatable)",
  "  --exclude <pattern>        Leave a vault path unpublished (repeatable)",
  "",
  "  -h, --help                 Show this text",
  "  --version                  Show canopy's version",
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
  "--site-url": "siteUrl",
  "--site-image": "siteImage",
  "--lang": "lang",
  "--color-scheme": "colorScheme",
  "--site-icon": "siteIcon",
  "--nav": "navPath",
  "--layout": "layoutPath",
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
  "--alternate": "alternate",
  "--feed": "feeds",
  "--stylesheet": "stylesheetPaths",
  "--site-stylesheet": "siteStylesheets",
} as const;

/**
 * The shape an absolute site URL has to have. Only the scheme is checked:
 * this is a guard against a relative path handed to a flag whose whole point
 * is to be absolute, not a URL validator.
 */
const ABSOLUTE_HTTP = /^https?:\/\//i;

/** The flags one command accepts, and where each one's value lands. */
interface FlagTable<V extends string, L extends string, B extends string> {
  value: Readonly<Record<string, V>>;
  list: Readonly<Record<string, L>>;
  boolean: Readonly<Record<string, B>>;
}

const BUILD_FLAGS = { value: VALUE_FLAGS, list: LIST_FLAGS, boolean: {} } as const;
const LIST_COMMAND_FLAGS = {
  value: { "--layout": "layoutPath" },
  list: { "--exclude": "exclude" },
  boolean: { "--json": "json" },
} as const;

type Scanned<V extends string, L extends string, B extends string> =
  | {
      ok: true;
      positional: string[];
      single: Partial<Record<V, string>>;
      lists: Record<L, string[]>;
      flags: Set<B>;
    }
  | { ok: false; error: string };

/**
 * Split one command's arguments into positionals and the flags it accepts.
 *
 * One loop for every command, driven by a table, so a command cannot grow its
 * own slightly different idea of what an unknown option or a missing value is.
 */
function scanArgs<V extends string, L extends string, B extends string>(
  command: string,
  argv: readonly string[],
  table: FlagTable<V, L, B>,
  maxPositional: number,
): Scanned<V, L, B> {
  const positional: string[] = [];
  const single: Partial<Record<V, string>> = {};
  const lists = Object.fromEntries(
    Object.values<L>(table.list).map((key) => [key, [] as string[]]),
  ) as Record<L, string[]>;
  const flags = new Set<B>();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) {
      continue; // unreachable within the loop bound; narrows away noUncheckedIndexedAccess
    }
    const listKey = table.list[arg];
    const valueKey = table.value[arg];
    const booleanKey = table.boolean[arg];
    if (listKey !== undefined || valueKey !== undefined) {
      const value = argv[i + 1];
      if (value === undefined) {
        return { ok: false, error: `${arg} requires a value` };
      }
      if (listKey !== undefined) lists[listKey].push(value);
      else if (valueKey !== undefined) single[valueKey] = value;
      i++;
    } else if (booleanKey !== undefined) {
      flags.add(booleanKey);
    } else if (arg.startsWith("-")) {
      // A flag canopy does not know is almost always a misspelled one. Taking
      // it as a path would build the site into a directory named after the
      // typo, with the intended option silently unset.
      return { ok: false, error: `Unknown option "${arg}" for ${command}\n\n${USAGE}` };
    } else if (positional.length === maxPositional) {
      return { ok: false, error: `Unexpected argument "${arg}"\n\n${USAGE}` };
    } else {
      positional.push(arg);
    }
  }
  return { ok: true, positional, single, lists, flags };
}

/** A parsed `canopy list` invocation, or the reason it could not be parsed. */
export type ListArgs =
  | { ok: true; vault: string; exclude: string[]; json: boolean; layoutPath?: string }
  | { ok: false; error: string };

export function parseListArgs(argv: string[]): ListArgs {
  const [command, ...rest] = argv;
  if (command !== "list") {
    return { ok: false, error: USAGE };
  }
  const scanned = scanArgs("list", rest, LIST_COMMAND_FLAGS, 1);
  if (!scanned.ok) return scanned;
  const vault = scanned.positional[0];
  if (vault === undefined) {
    return { ok: false, error: USAGE };
  }
  return {
    ok: true,
    vault,
    exclude: scanned.lists.exclude,
    json: scanned.flags.has("json"),
    layoutPath: scanned.single.layoutPath,
  };
}

/**
 * Whether the invocation asks about canopy rather than for a build.
 *
 * Checked before `parseBuildArgs`, and on every argument rather than only the
 * first: `canopy --help` and `canopy build --help` are the same question, and
 * both are a request that succeeded — answering one with the usage text plus a
 * failing exit code tells a script, and a reader skimming the output, that
 * something went wrong when nothing did. `--help` wins over `--version` when
 * both are given, since the usage text is the larger answer.
 */
export function requestedInfo(argv: readonly string[]): "help" | "version" | undefined {
  if (argv.some((arg) => arg === "--help" || arg === "-h")) return "help";
  if (argv.includes("--version")) return "version";
  return undefined;
}

export function parseBuildArgs(argv: string[]): BuildArgs {
  const [command, ...rest] = argv;
  if (command !== "build") {
    return { ok: false, error: USAGE };
  }

  const scanned = scanArgs("build", rest, BUILD_FLAGS, 2);
  if (!scanned.ok) return scanned;
  const { positional, single, lists } = scanned;
  const { exclude, rehypePluginPaths, alternate, feeds, stylesheetPaths, siteStylesheets } = lists;

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

  // The tags these feed are absolute URLs by definition, and --site-url is
  // the only place the absolute part can come from. Refusing here beats
  // accepting the flag and writing nothing, which would look like canopy
  // dropping an argument.
  if (single.siteUrl !== undefined && !ABSOLUTE_HTTP.test(single.siteUrl)) {
    return { ok: false, error: `--site-url: "${single.siteUrl}" must be an absolute http(s) URL` };
  }
  if (single.siteImage !== undefined && single.siteUrl === undefined) {
    return { ok: false, error: "--site-image needs --site-url: a preview image has to be an absolute URL" };
  }
  if (alternate.length > 0 && single.siteUrl === undefined) {
    return {
      ok: false,
      error: "--alternate needs --site-url: a page has to name its own edition alongside the others",
    };
  }
  if (feeds.length > 0 && single.siteUrl === undefined) {
    return { ok: false, error: "--feed needs --site-url: a feed's entries are absolute URLs" };
  }
  if (single.colorScheme !== undefined && single.colorScheme !== "light" && single.colorScheme !== "dark") {
    return { ok: false, error: `--color-scheme: expected light or dark, got "${single.colorScheme}"` };
  }
  let alternates: Record<string, string> | undefined;
  if (alternate.length > 0) {
    alternates = {};
    for (const entry of alternate) {
      const at = entry.indexOf("=");
      const hreflang = at === -1 ? "" : entry.slice(0, at).trim();
      const url = at === -1 ? "" : entry.slice(at + 1).trim();
      if (hreflang === "" || url === "") {
        return { ok: false, error: `--alternate: expected <lang>=<url>, got "${entry}"` };
      }
      if (!ABSOLUTE_HTTP.test(url)) {
        return { ok: false, error: `--alternate ${hreflang}: "${url}" must be an absolute http(s) URL` };
      }
      alternates[hreflang] = url;
    }
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
    siteUrl: single.siteUrl,
    siteImage: single.siteImage,
    alternates,
    lang: single.lang,
    ...(single.colorScheme !== undefined ? { colorScheme: single.colorScheme as "light" | "dark" } : {}),
    siteIcon: single.siteIcon,
    navPath: single.navPath,
    siteLogo: single.siteLogo,
    homeUrl: single.homeUrl,
    homeLabel: single.homeLabel,
    strings,
    searchIndexPath: single.searchIndexPath,
    scriptPath: single.scriptPath,
    rehypePluginPaths,
    stylesheetPaths,
    siteStylesheets,
    layoutPath: single.layoutPath,
    exclude,
    feeds,
  };
}
