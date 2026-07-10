import { describe, expect, it } from "vitest";
import { build } from "./index.js";
import { emitSite } from "./emit.js";

describe("emitSite", () => {
  it("emits one HTML file per page plus the token and layout stylesheets", async () => {
    const bundle = await build({
      documents: [
        { path: "index.md", content: "# Home" },
        { path: "notes/idea.md", content: "# Idea" },
      ],
    });
    const files = emitSite(bundle);
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual([
      "index.html",
      "notes/idea.html",
      "styles.css",
      "tokens.css",
    ]);
  });

  it("emits complete HTML documents linking tokens before layout", async () => {
    const bundle = await build({ documents: [{ path: "index.md", content: "# Home" }] });
    const index = emitSite(bundle).find((f) => f.path === "index.html");
    expect(index?.contents).toMatch(/^<!doctype html>/);
    const tokensAt = index?.contents.indexOf("tokens.css") ?? -1;
    const stylesAt = index?.contents.indexOf("styles.css") ?? -1;
    expect(tokensAt).toBeGreaterThan(-1);
    expect(tokensAt).toBeLessThan(stylesAt); // tokens load first
  });

  it("injects the consumer's tokens stylesheet when provided", async () => {
    const bundle = await build({ documents: [{ path: "index.md", content: "# Home" }] });
    const files = emitSite(bundle, { tokens: ":root { --accent: hotpink; }" });
    const tokens = files.find((f) => f.path === "tokens.css");
    expect(tokens?.contents).toBe(":root { --accent: hotpink; }");
  });

  it("includes extra stylesheets passed by the consumer", async () => {
    const bundle = await build({ documents: [{ path: "index.md", content: "# Home" }] });
    const files = emitSite(bundle, {
      stylesheets: ["tokens.css", "styles.css", "assets/katex.css"],
    });
    const index = files.find((f) => f.path === "index.html");
    expect(index?.contents).toContain('href="assets/katex.css"');
  });

  it("synthesizes a root contents index when the tree has no index.md", async () => {
    const bundle = await build({
      documents: [
        { path: "Welcome.md", content: "# Welcome" },
        { path: "notes/idea.md", content: "# Idea" },
      ],
    });
    const files = emitSite(bundle);
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual([
      "Welcome.html",
      "index.html",
      "notes/idea.html",
      "styles.css",
      "tokens.css",
    ]);
    const index = files.find((f) => f.path === "index.html");
    expect(index?.contents).toContain("<h1>Contents</h1>");
    expect(index?.contents).toContain('href="Welcome.html"');
  });

  it("keeps the author's index.md as the root page instead of synthesizing", async () => {
    const bundle = await build({
      documents: [{ path: "index.md", content: "# My Home" }],
    });
    const roots = emitSite(bundle).filter((f) => f.path === "index.html");
    expect(roots).toHaveLength(1);
    expect(roots[0]?.contents).toContain("My Home");
    expect(roots[0]?.contents).not.toContain('class="canopy-contents"');
  });

  it("emits a valid contents index for an empty tree", async () => {
    const bundle = await build({ documents: [] });
    const index = emitSite(bundle).find((f) => f.path === "index.html");
    expect(index?.contents).toMatch(/^<!doctype html>/);
  });

  it("does not synthesize over a root index page that differs only by case", async () => {
    const bundle = await build({
      documents: [{ path: "Index.md", content: "# My Real Home" }],
    });
    const files = emitSite(bundle);
    const indexish = files.filter((f) => f.path.toLowerCase() === "index.html");
    expect(indexish).toHaveLength(1);
    expect(indexish[0]?.contents).toContain("My Real Home");
    expect(indexish[0]?.contents).not.toContain("<h1>Contents</h1>");
  });
});
