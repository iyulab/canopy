import type { Paragraph, Parent, Root, RootContent } from "mdast";
import type { InlineMath, Math as MathNode } from "mdast-util-math";
import type { VFile } from "vfile";

/**
 * Narrows remark-math's tokenization to a conservative, currency-safe subset
 * and promotes standalone `$$..$$` lines to display math.
 *
 * Vanilla remark-math is greedy about single-dollar spans: `costs $5 and $10
 * total` renders "5 and " as a formula, and `$ x$` is math despite the space.
 * Prose that mentions prices should never silently become math, so spans that
 * violate any of these guards are demoted back to literal text:
 *
 *  - the opening `$` is followed by whitespace,
 *  - the closing `$` is preceded by whitespace,
 *  - the closing `$` is immediately followed by a digit.
 *
 * remark-math also treats a standalone `$$x$$` line as *inline* math (its
 * flow form only matches the fenced `$$\n..\n$$` shape). A paragraph an author
 * wrote as nothing but `$$..$$` lines is clearly display math, so it is
 * promoted: each span becomes a `math` node when it owns its lines (only
 * whitespace before the opening `$$` and after the closing `$$` on those
 * lines). Mixed paragraphs are left alone.
 *
 * Both rules mirror how conservative line-based editor scanners tokenize the
 * same source, keeping live preview and published output aligned; downstream
 * editors assert that alignment against `math-parity.golden.json`. The
 * deviations from vanilla remark-math are documented in the README.
 */
export default function remarkMathSubset() {
  return (tree: Root, file: VFile): void => {
    const src = String(file);
    demoteGuardedSpans(tree, src);
    promoteStandaloneLines(tree, src);
  };
}

/** Source offsets of a positioned node, or undefined when synthetic. */
function offsetsOf(node: InlineMath): [number, number] | undefined {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return start === undefined || end === undefined ? undefined : [start, end];
}

/** True when the single-`$` span at [start, end) violates a conservative guard. */
function violatesGuards(src: string, start: number, end: number): boolean {
  // `start` is the opening `$`, `end` is one past the closing `$` — the same
  // characters a line scanner inspects around the delimiters.
  if (/\s/.test(src[start + 1] ?? "")) return true;
  if (/\s/.test(src[end - 2] ?? "")) return true;
  const after = src[end];
  return after !== undefined && /[0-9]/.test(after);
}

/** Replace guard-violating single-`$` spans with their literal source text. */
function demoteGuardedSpans(parent: Parent, src: string): void {
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child === undefined) continue;
    if (child.type === "inlineMath") {
      const offsets = offsetsOf(child);
      if (!offsets) continue;
      const [start, end] = offsets;
      // Double-dollar spans are display material (see promotion), not inline
      // prose; the currency guards do not apply to them.
      if (src.startsWith("$$", start)) continue;
      if (violatesGuards(src, start, end)) {
        parent.children[i] = {
          type: "text",
          value: src.slice(start, end),
          position: child.position,
        };
      }
      continue;
    }
    if ("children" in child) demoteGuardedSpans(child, src);
  }
}

/** True when only whitespace surrounds [start, end) on its first and last line. */
function ownsItsLines(src: string, start: number, end: number): boolean {
  const lineStart = src.lastIndexOf("\n", start - 1) + 1;
  if (src.slice(lineStart, start).trim() !== "") return false;
  const nextBreak = src.indexOf("\n", end);
  const lineEnd = nextBreak === -1 ? src.length : nextBreak;
  return src.slice(end, lineEnd).trim() === "";
}

/**
 * A display `math` node carrying the same `data` shape mdast-util-math
 * attaches at parse time — mdast-util-to-hast has no built-in math handler, so
 * without it the node would fall through as bare text and rehype-katex would
 * never see the `math-display` marker.
 */
function displayMathNode(span: InlineMath): MathNode {
  return {
    type: "math",
    value: span.value,
    position: span.position,
    data: {
      hName: "pre",
      hChildren: [
        {
          type: "element",
          tagName: "code",
          properties: { className: ["language-math", "math-display"] },
          children: [{ type: "text", value: span.value }],
        },
      ],
    },
  };
}

/**
 * When the paragraph consists solely of standalone-line `$$..$$` spans (plus
 * whitespace), return one display `math` node per span; otherwise undefined.
 */
function standaloneRun(paragraph: Paragraph, src: string): MathNode[] | undefined {
  const out: MathNode[] = [];
  for (const child of paragraph.children) {
    if (child.type === "break") continue;
    if (child.type === "text" && child.value.trim() === "") continue;
    if (child.type !== "inlineMath") return undefined;
    const offsets = offsetsOf(child);
    if (!offsets) return undefined;
    const [start, end] = offsets;
    if (!src.startsWith("$$", start) || src.slice(end - 2, end) !== "$$") return undefined;
    if (!ownsItsLines(src, start, end)) return undefined;
    out.push(displayMathNode(child));
  }
  return out.length > 0 ? out : undefined;
}

/** Promote paragraphs made only of standalone `$$..$$` lines to display math. */
function promoteStandaloneLines(parent: Parent, src: string): void {
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child === undefined) continue;
    if (child.type === "paragraph") {
      const run = standaloneRun(child, src);
      if (run) {
        (parent.children as RootContent[]).splice(i, 1, ...run);
        i += run.length - 1;
      }
      continue;
    }
    if ("children" in child) promoteStandaloneLines(child, src);
  }
}
