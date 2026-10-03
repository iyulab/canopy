/**
 * Where canopy's own CSS sits in the cascade, and where a caller's goes.
 *
 * Everything canopy writes (tokens, layout, KaTeX) is wrapped in one cascade
 * layer, `canopy`. A rule outside any layer beats every layered rule regardless
 * of specificity, so a caller's stylesheet — linked after canopy's and
 * unlayered unless it declares a layer itself — wins over canopy's without a
 * specificity contest, whether it restates a token or hides a whole region.
 * A caller that ships its own layered CSS sits between the two: layers order
 * by first appearance, and canopy's always appears first.
 */
const LAYER = "canopy";

/** Wrap a stylesheet in canopy's cascade layer. The stylesheet must carry no `@import`/`@charset`. */
export function inCanopyLayer(css: string): string {
  return `@layer ${LAYER} {\n${css}\n}\n`;
}

/** Output path of the caller stylesheet at `index` (0-based), in the order it was given. */
export function callerStylesheetPath(index: number): string {
  return `assets/stylesheet-${index + 1}.css`;
}
