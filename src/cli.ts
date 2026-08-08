#!/usr/bin/env node
import path from "node:path";
import { createRequire } from "node:module";
import { mkdir, copyFile, readdir, readFile } from "node:fs/promises";
import { build } from "./index.js";
import { emitSite } from "./emit.js";
import { parseNavSpec, type NavSpec } from "./nav-spec.js";
import { readVault, writeFiles, copyAssets, listFiles } from "./fs-bundle.js";
import { parseBuildArgs } from "./cli-args.js";
import { bundleUsesKatex, KATEX_STYLESHEET } from "./katex.js";

const require = createRequire(import.meta.url);

/**
 * Copy KaTeX's stylesheet and woff2 fonts into the output so math renders
 * fully (the render core emits KaTeX HTML; this supplies its presentation).
 * The CSS references `fonts/...` relative to itself, so it sits beside them.
 */
async function copyKatexAssets(outDir: string): Promise<void> {
  const katexDir = path.dirname(require.resolve("katex/package.json"));
  const assetsDir = path.join(outDir, "assets");
  const fontsOut = path.join(assetsDir, "fonts");
  await mkdir(fontsOut, { recursive: true });
  await copyFile(
    path.join(katexDir, "dist", "katex.min.css"),
    path.join(assetsDir, "katex.css"),
  );
  const fontsDir = path.join(katexDir, "dist", "fonts");
  for (const font of await readdir(fontsDir)) {
    if (font.endsWith(".woff2")) {
      await copyFile(path.join(fontsDir, font), path.join(fontsOut, font));
    }
  }
}

async function main(): Promise<void> {
  const args = parseBuildArgs(process.argv.slice(2));
  if (!args.ok) {
    console.error(args.error);
    process.exitCode = 1;
    return;
  }

  const vault = path.resolve(args.vault);
  const outDir = path.resolve(args.out);
  // A caller may inject its own design tokens so the published site matches its look;
  // absent the flag, emitSite falls back to canopy's built-in tokens.
  let tokens: string | undefined;
  if (args.tokensCssPath !== undefined) {
    try {
      tokens = await readFile(path.resolve(args.tokensCssPath), "utf8");
    } catch {
      console.error(`--tokens-css: "${args.tokensCssPath}" could not be read`);
      process.exitCode = 1;
      return;
    }
  }

  // Carried unread past this point — canopy neither runs nor inspects it, only
  // writes it to assets/ and links it (see docs/SCOPE.md, "Author client-side code").
  let script: string | undefined;
  if (args.scriptPath !== undefined) {
    try {
      script = await readFile(path.resolve(args.scriptPath), "utf8");
    } catch {
      console.error(`--script: "${args.scriptPath}" could not be read`);
      process.exitCode = 1;
      return;
    }
  }

  // Both are copied by the asset pass, so they have to survive `--exclude` and
  // actually exist. Checking here turns a silently-broken tag — which only shows
  // up as a missing image after deploy — into a build failure naming the path.
  const published =
    args.siteIcon !== undefined || args.siteLogo !== undefined
      ? await listFiles(vault, args.exclude)
      : [];
  for (const [flag, value] of [
    ["--site-icon", args.siteIcon],
    ["--site-logo", args.siteLogo],
  ] as const) {
    if (value === undefined) continue;
    const rel = value.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!published.includes(rel)) {
      console.error(`${flag}: "${rel}" is not a published vault file (missing, or excluded)`);
      process.exitCode = 1;
      return;
    }
  }

  let nav: NavSpec | undefined;
  if (args.navPath !== undefined) {
    try {
      nav = parseNavSpec(await readFile(path.resolve(args.navPath), "utf8"));
    } catch (error) {
      // A spec is hand-edited, so a mistake in it is an authoring error: name the
      // file and the position rather than letting a half-applied order look like
      // canopy ignoring what it was given.
      console.error(
        `--nav ${args.navPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 1;
      return;
    }
  }

  const documents = await readVault(vault, args.exclude);
  const bundle = await build({ documents, ...(nav ? { nav } : {}) });

  // Report rather than fail: an omitted page may be deliberate, and canopy does
  // not know which. Saying so is what keeps the omission from being silent.
  for (const missing of bundle.navReport?.missing ?? []) {
    console.warn(`--nav: "${missing}" matches no page`);
  }
  const unplaced = bundle.navReport?.unplaced ?? [];
  if (unplaced.length > 0) {
    console.warn(
      `--nav: ${unplaced.length} page(s) not in the spec, so not in the navigation: ${unplaced.join(", ")}`,
    );
  }

  // Gate KaTeX assets on actual usage: a math-free site would otherwise carry
  // the stylesheet + ~20 woff2 fonts as dead payload (often most of its bytes).
  const usesKatex = bundleUsesKatex(bundle);
  const stylesheets = ["tokens.css", "styles.css"];
  if (usesKatex) {
    stylesheets.push(KATEX_STYLESHEET);
  }

  // The icon path was validated above; copyAssets mirrors it into the output at
  // the same path, so the shell only needs to know where to point.
  const files = emitSite(bundle, {
    siteTitle: args.siteTitle ?? path.basename(vault),
    stylesheets,
    tokens,
    ...(script !== undefined ? { script } : {}),
    ...(args.lang ? { lang: args.lang } : {}),
    ...(args.siteIcon ? { iconPath: args.siteIcon.replace(/\\/g, "/") } : {}),
    ...(args.siteDescription ? { description: args.siteDescription } : {}),
    ...(args.siteLogo ? { logoPath: args.siteLogo.replace(/\\/g, "/") } : {}),
    ...(args.homeUrl ? { homeUrl: args.homeUrl } : {}),
    ...(args.homeLabel ? { homeLabel: args.homeLabel } : {}),
    ...(args.searchIndexPath ? { searchIndexPath: args.searchIndexPath } : {}),
  });

  await writeFiles(outDir, files);
  if (usesKatex) {
    await copyKatexAssets(outDir);
  }
  const assetCount = await copyAssets(vault, outDir, args.exclude);

  console.log(
    `canopy: ${bundle.pages.length} page(s), ${assetCount} asset(s) -> ${outDir}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
