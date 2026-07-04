import { describe, expect, it } from "vitest";
import { build } from "./index.js";
import { bundleUsesKatex, KATEX_STYLESHEET } from "./katex.js";

describe("bundleUsesKatex", () => {
  it("is false for a math-free site", async () => {
    const bundle = await build({
      documents: [
        { path: "index.md", content: "# Home\n\nJust prose, no math." },
        { path: "notes/idea.md", content: "# Idea\n\nA list:\n\n- one\n- two" },
      ],
    });
    expect(bundleUsesKatex(bundle)).toBe(false);
  });

  it("is true when a page renders inline math", async () => {
    const bundle = await build({
      documents: [{ path: "index.md", content: "Euler: $e^{i\\pi}+1=0$." }],
    });
    expect(bundleUsesKatex(bundle)).toBe(true);
  });

  it("is true when a page renders display math", async () => {
    const bundle = await build({
      documents: [{ path: "index.md", content: "$$\n\\int_0^1 x\\,dx\n$$" }],
    });
    expect(bundleUsesKatex(bundle)).toBe(true);
  });

  it("is true when only one page among many uses math", async () => {
    const bundle = await build({
      documents: [
        { path: "index.md", content: "# Home\n\nNo math here." },
        { path: "prose.md", content: "Still no math." },
        { path: "math.md", content: "Formula $a^2+b^2=c^2$ inline." },
      ],
    });
    expect(bundleUsesKatex(bundle)).toBe(true);
  });

  it("is true when math fails to render (katex-error still needs the stylesheet)", async () => {
    const bundle = await build({
      documents: [{ path: "index.md", content: "Broken $\\frac{1}{$ math." }],
    });
    expect(bundleUsesKatex(bundle)).toBe(true);
  });

  it("is not forged by the literal marker in prose or a code span", async () => {
    const bundle = await build({
      documents: [
        {
          path: "index.md",
          content:
            '# On KaTeX\n\nWe use katex here. Even `class="katex"` in a code span.',
        },
      ],
    });
    // A code span escapes `<`, so the authored `class="katex"` renders as
    // `<code>class="katex"</code>` — no `<span class="katex` wrapper. No real
    // formula was rendered, so the site needs no KaTeX assets.
    expect(bundleUsesKatex(bundle)).toBe(false);
  });

  it("is not forged by a raw <span class=\"katex\"> in prose (sanitize strips the class)", async () => {
    const bundle = await build({
      documents: [
        { path: "index.md", content: 'Attempt: <span class="katex">forged</span>.' },
      ],
    });
    expect(bundleUsesKatex(bundle)).toBe(false);
  });

  it("exposes the KaTeX stylesheet site path", () => {
    expect(KATEX_STYLESHEET).toBe("assets/katex.css");
  });
});
