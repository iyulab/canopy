import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readDocuments, writeFiles, copyFiles, listVault } from "./fs-bundle.js";
import { build } from "./index.js";
import { emitSite } from "./emit.js";

/** Every file a listing publishes, pages and assets together, sorted. */
async function published(root: string, exclude: readonly string[] = []): Promise<string[]> {
  const listing = await listVault(root, exclude);
  return [...listing.pages, ...listing.assets].sort();
}

/** The pages a build of `root` reads. */
async function readPages(root: string, exclude: readonly string[] = []) {
  return readDocuments(root, (await listVault(root, exclude)).pages);
}

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "canopy-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("fs-bundle", () => {
  it("reads markdown, skips hidden dirs, builds, and writes a site", async () => {
    await withTempDir(async (tmp) => {
      const vault = path.join(tmp, "vault");
      await mkdir(path.join(vault, "notes"), { recursive: true });
      await mkdir(path.join(vault, ".obsidian"), { recursive: true });
      await writeFile(path.join(vault, "index.md"), "# Home\n\n[[idea]]");
      await writeFile(path.join(vault, "notes", "idea.md"), "# Idea");
      await writeFile(path.join(vault, "logo.png"), "PNGDATA");
      await writeFile(path.join(vault, ".obsidian", "app.json"), "{}");

      const docs = await readPages(vault);
      // .obsidian content is skipped; only markdown is read.
      expect(docs.map((d) => d.path)).toEqual(["index.md", "notes/idea.md"]);

      const out = path.join(tmp, "site");
      const bundle = await build({ documents: docs });
      await writeFiles(out, emitSite(bundle));
      const assetCount = await copyFiles(vault, out, (await listVault(vault)).assets);
      expect(assetCount).toBe(1); // logo.png, not the .obsidian json

      const indexHtml = await readFile(path.join(out, "index.html"), "utf8");
      expect(indexHtml).toContain("<!doctype html>");
      expect(await readFile(path.join(out, "logo.png"), "utf8")).toBe("PNGDATA");
      const outFiles = await published(out);
      expect(outFiles).toContain("notes/idea.html");
      expect(outFiles).toContain("tokens.css");
    });
  });

  // `exclude.test.ts` pins the rule itself; this checks it reaches the filesystem
  // walk — that an excluded directory is pruned at every depth, for markdown and
  // assets alike.
  it("excludes every dot-prefixed directory, not just well-known ones", async () => {
    await withTempDir(async (tmp) => {
      const vault = path.join(tmp, "vault");
      await mkdir(path.join(vault, ".some-unknown-tool"), { recursive: true });
      await mkdir(path.join(vault, "node_modules", "pkg"), { recursive: true });
      await mkdir(path.join(vault, ".nested", "deeper"), { recursive: true });
      await writeFile(path.join(vault, "index.md"), "# Home");
      await writeFile(path.join(vault, ".some-unknown-tool", "notes.md"), "# Hidden");
      await writeFile(path.join(vault, ".some-unknown-tool", "cache.bin"), "DATA");
      await writeFile(path.join(vault, "node_modules", "pkg", "readme.md"), "# Dep");
      await writeFile(path.join(vault, ".nested", "deeper", "buried.md"), "# Buried");

      // Neither markdown nor assets escape an excluded directory, at any depth.
      expect(await published(vault)).toEqual(["index.md"]);
      expect((await readPages(vault)).map((d) => d.path)).toEqual(["index.md"]);
    });
  });

  // A dot-prefixed file is tooling state too — and some of it is secret. A vault
  // that is also a code checkout keeps `.env` and `.gitignore` next to its notes.
  it("excludes dot-prefixed files at every depth", async () => {
    await withTempDir(async (tmp) => {
      const vault = path.join(tmp, "vault");
      await mkdir(path.join(vault, "guide"), { recursive: true });
      await writeFile(path.join(vault, "index.md"), "# Home");
      await writeFile(path.join(vault, ".env"), "SECRET=1");
      await writeFile(path.join(vault, ".gitignore"), "node_modules");
      await writeFile(path.join(vault, "guide", ".DS_Store"), "");
      await writeFile(path.join(vault, "guide", ".draft.md"), "# Hidden");
      await writeFile(path.join(vault, "guide", "shot.png"), "PNG");

      expect(await published(vault)).toEqual(["guide/shot.png", "index.md"]);
      expect((await readPages(vault)).map((d) => d.path)).toEqual(["index.md"]);
    });
  });

  it("applies caller-supplied exclude patterns to markdown and assets alike", async () => {
    await withTempDir(async (tmp) => {
      const vault = path.join(tmp, "vault");
      const out = path.join(tmp, "site");
      await mkdir(path.join(vault, "drafts", "deep"), { recursive: true });
      await mkdir(path.join(vault, "guide"), { recursive: true });
      await writeFile(path.join(vault, "index.md"), "# Home");
      await writeFile(path.join(vault, "guide", "a.md"), "# A");
      await writeFile(path.join(vault, "drafts", "wip.md"), "# WIP");
      // An excluded folder's images have no reason to be on the web either.
      await writeFile(path.join(vault, "drafts", "shot.png"), "PNG");
      await writeFile(path.join(vault, "drafts", "deep", "buried.md"), "# Buried");
      await writeFile(path.join(vault, "scratch.tmp"), "TMP");

      const exclude = ["drafts/**", "*.tmp"];
      expect(await published(vault, exclude)).toEqual(["guide/a.md", "index.md"]);
      expect((await readPages(vault, exclude)).map((d) => d.path)).toEqual([
        "guide/a.md",
        "index.md",
      ]);
      // No excluded asset reaches the output directory.
      expect(await copyFiles(vault, out, (await listVault(vault, exclude)).assets)).toBe(0);
    });
  });

  it("lists what a build would publish, split into pages and assets, without building", async () => {
    await withTempDir(async (tmp) => {
      const vault = path.join(tmp, "vault");
      await mkdir(path.join(vault, "drafts"), { recursive: true });
      await mkdir(path.join(vault, "guide"), { recursive: true });
      await mkdir(path.join(vault, ".git"), { recursive: true });
      await writeFile(path.join(vault, "index.md"), "# Home");
      await writeFile(path.join(vault, "guide", "a.MD"), "# A");
      await writeFile(path.join(vault, "guide", "shot.png"), "PNG");
      await writeFile(path.join(vault, "drafts", "wip.md"), "# WIP");
      await writeFile(path.join(vault, ".env"), "SECRET=1");
      await writeFile(path.join(vault, ".git", "HEAD"), "ref");

      const listing = await listVault(vault, ["drafts", "drafts/deep", "_archive", "*.tmp"]);
      expect(listing).toEqual({
        pages: ["guide/a.MD", "index.md"],
        assets: ["guide/shot.png"],
        // "_archive" named a place that isn't there; "drafts/deep" sat inside
        // a pruned tree and "*.tmp" is a standing rule — neither is a mistake.
        unusedExcludes: ["_archive"],
      });
    });
  });
});
