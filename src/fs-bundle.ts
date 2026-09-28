import { readdir, readFile, mkdir, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import type { SourceDocument, OutputFile } from "./contract.js";
import { isSkippedDir, isSkippedFile, trackExclusions, type ExclusionTracker } from "./exclude.js";

/**
 * Never-published directories (dot-prefixed, `node_modules`) live in
 * `exclude.ts` alongside the caller-supplied patterns, so both halves of "what
 * gets published" are stated in one place. The rule there is categorical rather
 * than a list of known names — a dot-prefix is the cross-platform convention for
 * "tooling state, not content", so any tool's hidden directory is excluded
 * without canopy having to know that tool exists.
 */
async function walk(
  root: string,
  rel: string,
  found: string[],
  exclusions: ExclusionTracker,
): Promise<void> {
  const entries = await readdir(path.join(root, rel), { withFileTypes: true });
  for (const entry of entries) {
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (isSkippedDir(entry.name)) continue;
      // Pruning at the directory keeps an excluded tree from being walked at
      // all, so a large archive folder costs nothing to skip.
      if (exclusions.excludes(childRel)) exclusions.pruned(childRel);
      else await walk(root, childRel, found, exclusions);
    } else if (entry.isFile() && !isSkippedFile(entry.name) && !exclusions.excludes(childRel)) {
      found.push(childRel);
    }
  }
}

/** Is this vault file a page to render, rather than an asset to copy? */
export function isMarkdown(relPath: string): boolean {
  return /\.md$/i.test(relPath);
}

/** What a vault publishes, split the way the build treats it. */
export interface VaultListing {
  /** Markdown files, rendered into pages — vault-relative POSIX paths, sorted. */
  pages: string[];
  /** Every other published file, copied as-is — vault-relative POSIX paths, sorted. */
  assets: string[];
  /** Place-naming `exclude` patterns that matched nothing (see `ExclusionTracker.unused`). */
  unusedExcludes: string[];
}

/**
 * What a build of this vault would publish, without building it.
 *
 * The same walk `listFiles` does, so the answer is the build's own rather
 * than a restatement of its rules — which is what lets a caller check a site
 * before publishing it and be right about what ships.
 */
export async function listVault(
  root: string,
  exclude: readonly string[] = [],
): Promise<VaultListing> {
  const found: string[] = [];
  const exclusions = trackExclusions(exclude);
  await walk(root, "", found, exclusions);
  found.sort();
  return {
    pages: found.filter(isMarkdown),
    assets: found.filter((f) => !isMarkdown(f)),
    unusedExcludes: exclusions.unused(),
  };
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
  await walk(root, "", found, trackExclusions(exclude));
  return found.sort();
}

/** Read all markdown documents under a vault directory into source documents. */
export async function readVault(
  root: string,
  exclude: readonly string[] = [],
): Promise<SourceDocument[]> {
  const markdown = (await listFiles(root, exclude)).filter(isMarkdown);
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
  const assets = (await listFiles(root, exclude)).filter((f) => !isMarkdown(f));
  for (const rel of assets) {
    const target = path.join(outDir, rel);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(root, rel), target);
  }
  return assets.length;
}
