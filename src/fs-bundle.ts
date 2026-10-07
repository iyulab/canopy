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
      if (isSkippedDir(entry.name)) {
        // Never published anyway, so a pattern naming it or something in it
        // is redundant rather than a pattern that matched nothing.
        exclusions.excludes(childRel);
        exclusions.pruned(childRel);
        continue;
      }
      // Pruning at the directory keeps an excluded tree from being walked at
      // all, so a large archive folder costs nothing to skip.
      if (exclusions.excludes(childRel)) exclusions.pruned(childRel);
      else await walk(root, childRel, found, exclusions);
    } else if (entry.isFile()) {
      // Tested even when the file is never published, for the same reason.
      const excluded = exclusions.excludes(childRel);
      if (!excluded && !isSkippedFile(entry.name)) found.push(childRel);
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
 * The build itself publishes from this listing, so the answer is the build's
 * own rather than a restatement of its rules — which is what lets a caller check a site
 * before publishing it and be right about what ships.
 *
 * `exclude` patterns apply to markdown and assets alike — a draft folder's
 * images have no reason to be on the web once its notes are not.
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
 * The exclusion that keeps a build's output out of its own input.
 *
 * An output directory inside the vault (`canopy build . site`) would otherwise
 * be read back in as vault files by the next build, which then publishes the
 * previous site inside the new one — the output would depend on what ran
 * before. Returns the vault-relative path to leave out (none when the output
 * lies elsewhere), or `undefined` when the output *is* the vault: the site
 * would be written over its own sources.
 */
export function outputExclusion(vault: string, out: string): string[] | undefined {
  const relative = path.relative(path.resolve(vault), path.resolve(out));
  if (relative === "") return undefined;
  const outside = path.isAbsolute(relative) || relative === ".." || relative.startsWith(`..${path.sep}`);
  return outside ? [] : [relative.split(path.sep).join("/")];
}

/** Why an output directory that is the vault itself is refused. */
export function outputIsVaultMessage(out: string): string {
  return `output directory "${out}" is the vault itself — the site would be written over its own sources`;
}

/** Read the listed markdown pages (vault-relative paths, as `listVault` gives them) into source documents. */
export async function readDocuments(
  root: string,
  pages: readonly string[],
): Promise<SourceDocument[]> {
  return Promise.all(
    pages.map(async (rel) => ({
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
 * Copy the listed files (vault-relative, as `listVault` gives its assets) into
 * the output, mirroring paths so relative links in the markdown keep resolving.
 * Returns the number of files copied.
 */
export async function copyFiles(
  root: string,
  outDir: string,
  files: readonly string[],
): Promise<number> {
  for (const rel of files) {
    const target = path.join(outDir, rel);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(root, rel), target);
  }
  return files.length;
}
