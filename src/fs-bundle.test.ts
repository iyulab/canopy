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
});
