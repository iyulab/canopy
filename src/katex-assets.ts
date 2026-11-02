// Node-only: where KaTeX's stylesheet and fonts come from when a site is written to disk.
import path from "node:path";
import { createRequire } from "node:module";

/**
 * The KaTeX that renders the math: this package's own, which `rehype-math.ts` imports — so its
 * stylesheet and fonts match the markup in every installation. A stylesheet from one KaTeX over
 * markup from another misplaces formulas.
 */
export function katexDirOfRenderer(): string {
  return path.dirname(createRequire(import.meta.url).resolve("katex/package.json"));
}
