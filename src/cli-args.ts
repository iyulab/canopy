/**
 * Pure argument parsing for the `canopy build` command. Kept separate from `cli.ts`
 * (which owns IO) so the contract is unit-testable: positional `<vault> [out]` plus the
 * optional `--site-title <title>` and `--tokens-css <path>` flags a host like Textree
 * passes to match the published site to its own design tokens.
 */

export type BuildArgs =
  | {
      ok: true;
      vault: string;
      out: string;
      siteTitle?: string;
      tokensCssPath?: string;
    }
  | { ok: false; error: string };

export const USAGE =
  "Usage: canopy build <vault-dir> [out-dir] [--site-title <title>] [--tokens-css <path>]";

const VALUE_FLAGS = new Set(["--site-title", "--tokens-css"]);

export function parseBuildArgs(argv: string[]): BuildArgs {
  const [command, ...rest] = argv;
  if (command !== "build") {
    return { ok: false, error: USAGE };
  }

  const positional: string[] = [];
  let siteTitle: string | undefined;
  let tokensCssPath: string | undefined;

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === undefined) {
      continue; // unreachable within the loop bound; narrows away noUncheckedIndexedAccess
    }
    if (VALUE_FLAGS.has(arg)) {
      const value = rest[i + 1];
      if (value === undefined) {
        return { ok: false, error: `${arg} requires a value` };
      }
      if (arg === "--site-title") {
        siteTitle = value;
      } else {
        tokensCssPath = value;
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
  return { ok: true, vault, out: positional[1] ?? "site", siteTitle, tokensCssPath };
}
