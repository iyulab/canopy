import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { katexDirOfRenderer } from "./katex-assets.js";

describe("katexDirOfRenderer", () => {
  it("is the KaTeX that rehype-katex renders with, stylesheet and fonts included", () => {
    const dir = katexDirOfRenderer();
    const rendererKatex = createRequire(import.meta.resolve("rehype-katex"))("katex/package.json");
    const found = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));
    expect(found.version).toBe(rendererKatex.version);
    expect(readFileSync(path.join(dir, "dist", "katex.min.css"), "utf8").length).toBeGreaterThan(0);
  });
});
