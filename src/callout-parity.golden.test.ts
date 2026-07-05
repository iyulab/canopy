import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./render.js";

/**
 * Golden guard for the `published` column of callout-parity.golden.json:
 * every case's rendered HTML must recognize exactly the callouts the spec
 * says. A failure here means the published callout semantics moved — update
 * the spec (and every byte-identical copy downstream) only as a deliberate
 * decision.
 */
interface GoldenCallout {
  type: string;
  title: string;
}

interface GoldenCase {
  name: string;
  markdown: string;
  published: GoldenCallout[];
  editor: GoldenCallout[];
  note?: string;
  editorGate?: string;
}

const spec = JSON.parse(
  readFileSync(new URL("./callout-parity.golden.json", import.meta.url), "utf8"),
) as { version: number; cases: GoldenCase[] };

/**
 * Ordered callouts in a rendered page. The transform emits
 * `<blockquote class="callout callout-{core}">` followed by the title
 * paragraph; fixture inputs contain no authored HTML, so the markers are
 * unforgeable here.
 */
function classifyPublished(html: string): GoldenCallout[] {
  const out: GoldenCallout[] = [];
  const re = /<blockquote class="callout callout-([a-z]+)">\s*<p class="callout-title">([^<]*)<\/p>/g;
  for (const m of html.matchAll(re)) out.push({ type: m[1] as string, title: m[2] as string });
  return out;
}

describe("callout parity golden — published column", () => {
  for (const c of spec.cases) {
    it(`${c.name}`, async () => {
      expect(classifyPublished(await renderMarkdown(c.markdown))).toEqual(c.published);
    });
  }
});
