import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./render.js";

/**
 * Golden guard for the `published` column of math-parity.golden.json: every
 * case's rendered HTML must classify exactly as the spec says, including the
 * documented divergences from editor scanners. A failure here means the
 * published math semantics moved — update the spec (and every byte-identical
 * copy downstream) only as a deliberate decision.
 */
interface GoldenCase {
  name: string;
  markdown: string;
  published: string[];
  editor: string[];
  note?: string;
  editorGate?: string;
}

const spec = JSON.parse(
  readFileSync(new URL("./math-parity.golden.json", import.meta.url), "utf8"),
) as { version: number; cases: GoldenCase[] };

/**
 * Ordered math renderings in a rendered page. KaTeX emits one MathML `<math>`
 * element per formula (`display="block"` on display math) and a
 * `katex-error` span when parsing fails; source order comes from match
 * offsets. Fixture inputs contain no authored HTML, so the markers are
 * unforgeable here.
 */
function classifyPublished(html: string): string[] {
  const found: { at: number; kind: string }[] = [];
  for (const m of html.matchAll(/<span class="katex-error"/g)) {
    found.push({ at: m.index, kind: "error" });
  }
  for (const m of html.matchAll(/<math [^>]*>/g)) {
    found.push({ at: m.index, kind: m[0].includes('display="block"') ? "display" : "inline" });
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.kind);
}

describe("math parity golden — published column", () => {
  for (const c of spec.cases) {
    it(`${c.name}: [${c.published.join(", ")}]`, async () => {
      expect(classifyPublished(await renderMarkdown(c.markdown))).toEqual(c.published);
    });
  }
});
