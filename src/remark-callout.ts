import type { Blockquote, Paragraph, Root } from "mdast";
// Pull in mdast-util-to-hast's Data augmentation (hProperties on mdast nodes).
// Transitive via remark-rehype — same pattern as remark-math-subset's mdast-util-math types.
import type {} from "mdast-util-to-hast";

/**
 * Transforms top-level blockquotes written in the `> [!type]` callout
 * convention into styled callouts: the marker line is removed, the
 * blockquote gains `callout callout-{core}` classes, and a
 * `<p class="callout-title">` is prepended. The element stays a
 * `<blockquote>` so the content degrades gracefully without CSS.
 *
 * v1 scope (mirrored by the editor and pinned in
 * callout-parity.golden.json):
 *  - the marker must open the quote's first line: `[!type]`, ASCII letters
 *    only, case-insensitive, optionally followed by a fold suffix (`-`/`+`,
 *    accepted and ignored) and a same-line title;
 *  - five core styles (note, tip, warning, danger, quote); aliases and
 *    unknown types fall back per CALLOUT_ALIASES so nothing breaks;
 *  - the displayed title is the explicit text, or the typed word with its
 *    first letter uppercased (the author's word is respected for aliases);
 *  - only top-level blockquotes transform — nested quotes stay plain.
 */
export type CalloutCore = "note" | "tip" | "warning" | "danger" | "quote";

const CALLOUT_ALIASES: Record<string, CalloutCore> = {
  note: "note", info: "note", abstract: "note", summary: "note", tldr: "note", todo: "note", example: "note",
  tip: "tip", hint: "tip", important: "tip",
  warning: "warning", caution: "warning", attention: "warning", question: "warning", help: "warning", faq: "warning",
  danger: "danger", error: "danger", failure: "danger", fail: "danger", missing: "danger", bug: "danger",
  quote: "quote", cite: "quote",
};

// `[!type]` at the start of the quote's first line: optional fold suffix,
// then either the end of the line or a space and a title. A non-space
// character right after the marker (e.g. `[!note]x`) is not a callout.
const HEADER_RE = /^\[!([A-Za-z]+)\]([-+])?(?:[ \t]+([^\n]*))?(\n|$)/;

export default function remarkCallout() {
  return (tree: Root): void => {
    for (const node of tree.children) {
      if (node.type === "blockquote") transformCallout(node);
    }
  };
}

function transformCallout(quote: Blockquote): void {
  const para = quote.children[0];
  if (para === undefined || para.type !== "paragraph") return;
  const first = para.children[0];
  if (first === undefined || first.type !== "text") return;
  const m = HEADER_RE.exec(first.value);
  if (m === null) return;
  const rawType = m[1] as string;
  const core = CALLOUT_ALIASES[rawType.toLowerCase()] ?? "note";
  const explicit = (m[3] ?? "").trim();
  const title = explicit !== "" ? explicit : rawType.charAt(0).toUpperCase() + rawType.slice(1);
  // Strip the marker line (including its line break) from the source text.
  first.value = first.value.slice(m[0].length);
  if (first.value === "") para.children.shift();
  if (para.children.length === 0) quote.children.shift();
  quote.data = { ...quote.data, hProperties: { className: ["callout", `callout-${core}`] } };
  const titleNode: Paragraph = {
    type: "paragraph",
    data: { hProperties: { className: ["callout-title"] } },
    children: [{ type: "text", value: title }],
  };
  quote.children.unshift(titleNode);
}
