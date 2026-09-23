// Node-only: where KaTeX's stylesheet and fonts come from when a site is written to disk.
import path from "node:path";
import { createRequire } from "node:module";

/**
 * The KaTeX that actually renders the math: the one rehype-katex imports. Resolving `katex` from
 * here instead finds canopy's own dependency, which is a different copy whenever the installing
 * project does not apply canopy's `overrides` (npm reads those from the root project only) — and a
 * stylesheet from one KaTeX over markup from another misplaces formulas.
 */
export function katexDirOfRenderer(): string {
  const renderer = createRequire(import.meta.resolve("rehype-katex"));
  return path.dirname(renderer.resolve("katex/package.json"));
}
