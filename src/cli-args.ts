/**
 * Pure argument parsing for the `canopy build` command. Kept separate from `cli.ts`
 * (which owns IO) so the contract is unit-testable: positional `<vault> [out]` plus the
 * optional `--site-title <title>` and `--tokens-css <path>` flags, which let a caller
 * match the published site to its own design tokens.
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
  "  --tokens-css <path>        Design tokens to write as tokens.css",
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
} as const;

/**
 * Repeatable flags collect every occurrence. Repeating beats a delimiter, which
 * would collide with the path characters these values contain.
 */
const LIST_FLAGS = { "--exclude": "exclude" } as const;

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
        exclude.push(value);
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
    exclude,
  };
}
