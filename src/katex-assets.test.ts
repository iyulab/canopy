import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { build } from "./index.js";
import { katexDirOfRenderer } from "./katex-assets.js";

describe("katexDirOfRenderer", () => {
  it("holds the stylesheet and fonts a site ships", () => {
    const dir = katexDirOfRenderer();
    expect(readFileSync(path.join(dir, "dist", "katex.min.css"), "utf8").length).toBeGreaterThan(0);
  });
});

describe("the KaTeX that renders is the KaTeX whose stylesheet ships", () => {
  // KaTeX renames its internal classes between versions (0.18 prefixed them), so markup from one
  // copy under a stylesheet from another is unstyled math. Every class the rendered markup uses
  // must be one the shipped stylesheet styles — the property a site's readers actually depend on.
  it("styles every class the rendered math uses", async () => {
    const bundle = await build({
      documents: [{ path: "index.md", content: "Inline $x^2 + \\frac{a}{b}$ and\n\n$$\n\\sum_{i=1}^n i\n$$\n" }],
    });
    const html = bundle.pages[0]?.html ?? "";
    const css = readFileSync(path.join(katexDirOfRenderer(), "dist", "katex.min.css"), "utf8");
    // Only the formulas' markup: what sits inside KaTeX's wrapper.
    const math = [...html.matchAll(/<span class="katex[\s\S]*?<\/math>[\s\S]*?(?=<\/p>|<\/div>|$)/g)].join("");
    const classes = new Set(
      [...math.matchAll(/class="([^"]*)"/g)].flatMap((match) => (match[1] ?? "").split(/\s+/)).filter(Boolean),
    );
    // KaTeX's atom classes name what a symbol is (ordinary, binary operator, …) and `mtight` marks
    // script size; no version styles them on their own. Old markup under a new sheet leaves e.g. `base`
    // and `strut` unstyled — what this catches.
    const atoms = new Set(["mord", "mbin", "mrel", "mop", "mopen", "mclose", "mpunct", "minner", "mtight"]);
    const styled = [...classes].filter((name) => !atoms.has(name));
    expect(styled.length).toBeGreaterThan(5);
    const unstyled = styled.filter((name) => !css.includes(`.${name}`));
    expect(unstyled).toEqual([]);
  });
});
