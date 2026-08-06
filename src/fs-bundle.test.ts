import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readVault, writeFiles, copyAssets, listFiles } from "./fs-bundle.js";
import { build } from "./index.js";
import { emitSite } from "./emit.js";

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

      const docs = await readVault(vault);
      // .obsidian content is skipped; only markdown is read.
      expect(docs.map((d) => d.path)).toEqual(["index.md", "notes/idea.md"]);

      const out = path.join(tmp, "site");
      const bundle = await build({ documents: docs });
      await writeFiles(out, emitSite(bundle));
      const assetCount = await copyAssets(vault, out);
      expect(assetCount).toBe(1); // logo.png, not the .obsidian json

      const indexHtml = await readFile(path.join(out, "index.html"), "utf8");
      expect(indexHtml).toContain("<!doctype html>");
      expect(await readFile(path.join(out, "logo.png"), "utf8")).toBe("PNGDATA");
      const outFiles = await listFiles(out);
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
      expect(await listFiles(vault)).toEqual(["index.md"]);
      expect((await readVault(vault)).map((d) => d.path)).toEqual(["index.md"]);
    });
  });

  // A dot-prefix excludes directories only. A dotfile at the top level is content the
  // caller placed in the vault, so it is copied like any other asset.
  it("keeps dot-prefixed files, excluding only directories", async () => {
    await withTempDir(async (tmp) => {
      const vault = path.join(tmp, "vault");
      await mkdir(vault, { recursive: true });
      await writeFile(path.join(vault, "index.md"), "# Home");
      await writeFile(path.join(vault, ".nojekyll"), "");

      expect(await listFiles(vault)).toEqual([".nojekyll", "index.md"]);
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
      expect(await listFiles(vault, exclude)).toEqual(["guide/a.md", "index.md"]);
      expect((await readVault(vault, exclude)).map((d) => d.path)).toEqual([
        "guide/a.md",
        "index.md",
      ]);
      // No excluded asset reaches the output directory.
      expect(await copyAssets(vault, out, exclude)).toBe(0);
    });
  });
});
