import { readdir, readFile, mkdir, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import type { SourceDocument, OutputFile } from "./contract.js";
import { isSkippedDir, createExcluder } from "./exclude.js";

/**
 * Never-published directories (dot-prefixed, `node_modules`) live in
 * `exclude.ts` alongside the caller-supplied patterns, so both halves of "what
 * gets published" are stated in one place. The rule there is categorical rather
 * than a list of known names — a dot-prefix is the cross-platform convention for
 * "tooling state, not content", so any tool's hidden directory is excluded
 * without canopy having to know that tool exists.
 */
type Excluder = (relPath: string) => boolean;

async function walk(
  root: string,
  rel: string,
  found: string[],
  excluded: Excluder,
): Promise<void> {
  const entries = await readdir(path.join(root, rel), { withFileTypes: true });
  for (const entry of entries) {
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      // Pruning at the directory keeps an excluded tree from being walked at
      // all, so a large archive folder costs nothing to skip.
      if (!isSkippedDir(entry.name) && !excluded(childRel)) {
        await walk(root, childRel, found, excluded);
      }
    } else if (entry.isFile() && !excluded(childRel)) {
      found.push(childRel);
    }
  }
}

/**
 * List every publishable file under `root` as POSIX paths relative to it, sorted.
 *
 * `exclude` patterns apply to markdown and assets alike — a draft folder's
 * images have no reason to be on the web once its notes are not — because every
 * caller of this function shares the same view of the vault.
 */
export async function listFiles(
  root: string,
  exclude: readonly string[] = [],
): Promise<string[]> {
  const found: string[] = [];
  await walk(root, "", found, createExcluder(exclude));
  return found.sort();
}

/** Read all markdown documents under a vault directory into source documents. */
export async function readVault(
  root: string,
  exclude: readonly string[] = [],
): Promise<SourceDocument[]> {
  const markdown = (await listFiles(root, exclude)).filter((f) => /\.md$/i.test(f));
  return Promise.all(
    markdown.map(async (rel) => ({
      path: rel,
      content: await readFile(path.join(root, rel), "utf8"),
    })),
  );
}

/** Write rendered output files under `outDir`, creating folders as needed. */
export async function writeFiles(
  outDir: string,
  files: readonly OutputFile[],
): Promise<void> {
  for (const file of files) {
    const target = path.join(outDir, file.path);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.contents, "utf8");
  }
}

/**
 * Copy every non-markdown file (images, etc.) from the vault into the output,
 * mirroring paths so relative links in the markdown keep resolving. Returns
 * the number of files copied.
 */
export async function copyAssets(
  root: string,
  outDir: string,
  exclude: readonly string[] = [],
): Promise<number> {
  const assets = (await listFiles(root, exclude)).filter((f) => !/\.md$/i.test(f));
  for (const rel of assets) {
    const target = path.join(outDir, rel);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(root, rel), target);
  }
  return assets.length;
}
