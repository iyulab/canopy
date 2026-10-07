import path from "node:path";
import { readFile } from "node:fs/promises";
import { listVault, outputExclusion, outputIsVaultMessage } from "./fs-bundle.js";
import { parseListArgs } from "./cli-args.js";
import { type Layout, layoutFragments, parseLayout, streamPagePaths, syntheticIndexPaths } from "./layout.js";
import { toSitePath } from "./site-path.js";

/**
 * `canopy list`: what `build` would publish, without building it.
 *
 * stdout carries the answer and nothing else — a caller parses it — so a
 * vault that cannot be read is reported on stderr with a failing exit code.
 *
 * Given the layout a build will use, the answer is the build's: the fragments
 * a layout names are read, not published, so they leave the listing; and the
 * index pages a build writes for stream folders appear as `generated` (site
 * paths, not vault files), so a caller checking links can see they will exist.
 * Given the output directory, the build's output is left out as the build
 * leaves it out of its own input.
 */
export async function runList(argv: string[]): Promise<void> {
  const args = parseListArgs(argv);
  if (!args.ok) {
    console.error(args.error);
    process.exitCode = 1;
    return;
  }
  let layout: Layout | undefined;
  if (args.layoutPath !== undefined) {
    try {
      layout = parseLayout(await readFile(path.resolve(args.layoutPath), "utf8"));
    } catch (error) {
      console.error(`--layout ${args.layoutPath}: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
      return;
    }
  }
  // Given where the build will write, the build's own output is left out as the
  // build leaves it out — and it may not exist yet, which is no unused exclude.
  const ownOutput = args.out === undefined ? [] : outputExclusion(args.vault, args.out);
  if (ownOutput === undefined) {
    console.error(outputIsVaultMessage(args.out ?? ""));
    process.exitCode = 1;
    return;
  }
  const fragments = layoutFragments(layout).map((fragment) => fragment.path);
  const listing = await listVault(path.resolve(args.vault), [...args.exclude, ...fragments, ...ownOutput]);
  // A fragment that is missing is the build's to report, with the region it
  // was meant for; here it is not an exclusion the caller wrote.
  const unusedExcludes = listing.unusedExcludes.filter(
    (pattern) => !fragments.includes(pattern) && !ownOutput.includes(pattern),
  );
  if (args.json) {
    const sitePaths = listing.pages.map(toSitePath);
    const generated = [...syntheticIndexPaths(layout, sitePaths), ...streamPagePaths(layout, sitePaths)];
    console.log(JSON.stringify({ pages: listing.pages, assets: listing.assets, unusedExcludes, generated }));
    return;
  }
  for (const file of [...listing.pages, ...listing.assets].sort()) {
    console.log(file);
  }
  for (const pattern of unusedExcludes) {
    console.error(`canopy: --exclude ${pattern} matched nothing`);
  }
}
