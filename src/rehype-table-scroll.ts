import { SKIP, visit } from "unist-util-visit";
import type { Element, Root } from "hast";

/** The class on the box each table scrolls inside — a public hook (theme-hooks.ts). */
export const TABLE_SCROLL_CLASS = "canopy-table";

/**
 * Wrap every table in a box that scrolls sideways, so a table wider than the
 * screen scrolls within itself instead of pushing the whole page sideways.
 *
 * A wrapper rather than restyling the table (`display: block` on `<table>`, as
 * some stylesheets do): changing a table's display has dropped its table
 * semantics in some browser/screen reader pairings, and the wrapper costs
 * nothing — the table inside keeps `display: table`, its rows and headers
 * exactly as written. The wrapper carries the same scroll-shadow treatment a
 * wide code block has (styles.ts).
 *
 * Runs after rehype-sanitize, so the class is canopy's own: an author's
 * `class="canopy-table"` in raw HTML is stripped by the sanitizer before this
 * runs, and every table gets exactly one box.
 */
export default function rehypeTableScroll() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName !== "table" || parent === undefined || index === undefined) return;
      const wrapper: Element = {
        type: "element",
        tagName: "div",
        properties: { className: [TABLE_SCROLL_CLASS] },
        children: [node],
      };
      parent.children[index] = wrapper;
      return [SKIP, index + 1];
    });
  };
}

