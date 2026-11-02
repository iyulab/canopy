import type { Element, ElementContent, Root, RootContent } from "hast";
import { fromHtml } from "hast-util-from-html";
import katex from "katex";
import { SKIP, visit } from "unist-util-visit";
import type { VFile } from "vfile";

/**
 * Math, rendered with this package's own KaTeX.
 *
 * remark-math marks inline math `<code class="language-math math-inline">` and display math
 * `<pre><code class="language-math math-display">`; a ` ```math ` fence arrives as
 * `<pre><code class="language-math">`. Each is replaced by KaTeX's HTML.
 *
 * Rendering here rather than through a plugin that brings its own KaTeX is what makes the
 * KaTeX that writes the markup the one whose stylesheet the site ships (`katex-assets.ts`), in
 * every installation: a plugin's copy follows the plugin's version range, and the `overrides`
 * that could pin it are read by npm from the installing project only — so every project that
 * installed canopy rendered with an older KaTeX than the one canopy declared.
 */

const MATH = "language-math";
const DISPLAY = "math-display";
const INLINE = "math-inline";

function classesOf(node: Element): readonly unknown[] {
  const className = node.properties.className;
  return Array.isArray(className) ? className : [];
}

function isMath(node: Element): boolean {
  const classes = classesOf(node);
  return classes.includes(MATH) || classes.includes(DISPLAY) || classes.includes(INLINE);
}

/** The text a math element holds, as written (whitespace kept). */
function textOf(node: Element | ElementContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") return node.children.map(textOf).join("");
  return "";
}

/** KaTeX's HTML for `tex`, or the error markup KaTeX itself would give — never a thrown error. */
function render(tex: string, displayMode: boolean, file: VFile, place: Element): ElementContent[] {
  let html: string;
  try {
    html = katex.renderToString(tex, { displayMode, throwOnError: true });
  } catch (error) {
    const cause = error as Error;
    file.message("Could not render math with KaTeX", {
      cause,
      place: place.position,
      ruleId: cause.name.toLowerCase(),
      source: "canopy-math",
    });
    try {
      html = katex.renderToString(tex, { displayMode, strict: "ignore", throwOnError: false });
    } catch {
      // KaTeX reports a ParseError as markup itself; anything else gets the same shape by hand.
      return [
        {
          type: "element",
          tagName: "span",
          properties: { className: ["katex-error"], style: "color:#cc0000", title: String(error) },
          children: [{ type: "text", value: tex }],
        },
      ];
    }
  }
  return fromHtml(html, { fragment: true }).children as ElementContent[];
}

export default function rehypeMath() {
  return (tree: Root, file: VFile) => {
    visit(tree, "element", (node, index, parent) => {
      if (parent === undefined || index === undefined) return;
      let tex: string;
      let displayMode: boolean;
      const [only] = node.children;
      if (
        node.tagName === "pre" &&
        node.children.length === 1 &&
        only?.type === "element" &&
        only.tagName === "code" &&
        classesOf(only).includes(MATH)
      ) {
        // Display math, or a ```math fence: the whole <pre> is the formula.
        tex = textOf(only);
        displayMode = true;
      } else if (isMath(node)) {
        tex = textOf(node);
        displayMode = classesOf(node).includes(DISPLAY);
      } else {
        return;
      }
      const replacement = render(tex, displayMode, file, node);
      (parent.children as RootContent[]).splice(index, 1, ...replacement);
      return [SKIP, index + replacement.length];
    });
  };
}
