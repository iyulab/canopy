import { readdir, readFile, mkdir, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import type { SourceDocument, OutputFile } from "./contract.js";

/** Directories never published: hidden dirs (.git, .textree, .obsidian) and deps. */
function isSkippedDir(name: string): boolean {
  return name.startsWith(".") || name === "node_modules";
}

async function walk(root: string, rel: string, found: string[]): Promise<void> {
  const entries = await readdir(path.join(root, rel), { withFileTypes: true });
  for (const entry of entries) {
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!isSkippedDir(entry.name)) {
        await walk(root, childRel, found);
      }
    } else if (entry.isFile()) {
      found.push(childRel);
    }
  }
}

/** List every file under `root` as POSIX paths relative to it, sorted. */
export async function listFiles(root: string): Promise<string[]> {
  const found: string[] = [];
  await walk(root, "", found);
  return found.sort();
}

/** Read all markdown documents under a vault directory into source documents. */
export async function readVault(root: string): Promise<SourceDocument[]> {
  const markdown = (await listFiles(root)).filter((f) => /\.md$/i.test(f));
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
export async function copyAssets(root: string, outDir: string): Promise<number> {
  const assets = (await listFiles(root)).filter((f) => !/\.md$/i.test(f));
  for (const rel of assets) {
    const target = path.join(outDir, rel);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(root, rel), target);
  }
  return assets.length;
}
