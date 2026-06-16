#!/usr/bin/env node
import path from "node:path";
import { createRequire } from "node:module";
import { mkdir, copyFile, readdir } from "node:fs/promises";
import { build } from "./index.js";
import { emitSite } from "./emit.js";
import { readVault, writeFiles, copyAssets } from "./fs-bundle.js";

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
  const [command, vaultArg, outArg] = process.argv.slice(2);
  if (command !== "build" || vaultArg === undefined) {
    console.error("Usage: canopy build <vault-dir> [out-dir]");
    process.exitCode = 1;
    return;
  }

  const vault = path.resolve(vaultArg);
  const outDir = path.resolve(outArg ?? "site");

  const documents = await readVault(vault);
  const bundle = await build({ documents });
  const files = emitSite(bundle, {
    siteTitle: path.basename(vault),
    stylesheets: ["tokens.css", "styles.css", "assets/katex.css"],
  });

  await writeFiles(outDir, files);
  await copyKatexAssets(outDir);
  const assetCount = await copyAssets(vault, outDir);

  console.log(
    `canopy: ${bundle.pages.length} page(s), ${assetCount} asset(s) -> ${outDir}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
