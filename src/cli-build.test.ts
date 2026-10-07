import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runBuild } from "./cli-build.js";

/**
 * The CLI's own IO around emitSite: reading caller stylesheets, refusing a
 * path the vault already publishes, and layering the KaTeX stylesheet it
 * copies. Each case renders a real (tiny) vault, so the ceiling is generous.
 */
const RENDERS = 60_000;
const temporary: string[] = [];

async function vault(files: Record<string, string>): Promise<{ root: string; out: string }> {
  const root = await mkdtemp(path.join(tmpdir(), "canopy-cli-build-"));
  temporary.push(root);
  for (const [rel, content] of Object.entries(files)) {
    await mkdir(path.join(root, "vault", path.dirname(rel)), { recursive: true });
    await writeFile(path.join(root, "vault", rel), content, "utf8");
  }
  return { root, out: path.join(root, "out") };
}

afterEach(async () => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
  await Promise.all(temporary.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("canopy build --stylesheet", { timeout: RENDERS }, () => {
  it("carries each stylesheet into assets/, linked after canopy's own, in order", async () => {
    const { root, out } = await vault({ "index.md": "# Home\n" });
    await writeFile(path.join(root, "brand.css"), ":root { --accent: #0a7c5a; }", "utf8");
    await writeFile(path.join(root, "layout.css"), ".canopy-sidebar { display: none; }", "utf8");
    vi.spyOn(console, "log").mockImplementation(() => {});

    await runBuild([
      "build",
      path.join(root, "vault"),
      out,
      "--stylesheet",
      path.join(root, "brand.css"),
      "--stylesheet",
      path.join(root, "layout.css"),
    ]);

    expect(process.exitCode).toBeUndefined();
    expect(await readFile(path.join(out, "assets", "stylesheet-1.css"), "utf8")).toBe(
      ":root { --accent: #0a7c5a; }",
    );
    expect(await readFile(path.join(out, "assets", "stylesheet-2.css"), "utf8")).toBe(
      ".canopy-sidebar { display: none; }",
    );
    const home = await readFile(path.join(out, "index.html"), "utf8");
    expect(home.indexOf('href="styles.css"')).toBeLessThan(home.indexOf('href="assets/stylesheet-1.css"'));
    expect(home.indexOf('href="assets/stylesheet-1.css"')).toBeLessThan(
      home.indexOf('href="assets/stylesheet-2.css"'),
    );
  });

  it("fails naming the path when a stylesheet cannot be read", async () => {
    const { root, out } = await vault({ "index.md": "# Home\n" });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await runBuild(["build", path.join(root, "vault"), out, "--stylesheet", path.join(root, "missing.css")]);

    expect(process.exitCode).toBe(1);
    expect(error.mock.calls.flat().join("\n")).toContain("--stylesheet:");
    expect(error.mock.calls.flat().join("\n")).toContain("missing.css");
  });

  it("refuses when the vault already publishes a file at a stylesheet's path", async () => {
    const { root, out } = await vault({
      "index.md": "# Home\n",
      "assets/stylesheet-1.css": "/* the vault's own */",
    });
    await writeFile(path.join(root, "brand.css"), "a {}", "utf8");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await runBuild(["build", path.join(root, "vault"), out, "--stylesheet", path.join(root, "brand.css")]);

    expect(process.exitCode).toBe(1);
    expect(error.mock.calls.flat().join("\n")).toContain("assets/stylesheet-1.css");
  });
});

describe("canopy build — paths canopy writes itself", { timeout: RENDERS }, () => {
  it("refuses a vault file at one of canopy's own outputs, naming each collision, and writes nothing", async () => {
    const { root, out } = await vault({
      "index.md": "# Home\n",
      "tokens.css": ":root { --accent: red; }",
      "index.html": "<p>hand-written</p>",
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await runBuild(["build", path.join(root, "vault"), out, "--site-stylesheet", "tokens.css"]);

    expect(process.exitCode).toBe(1);
    const message = error.mock.calls.flat().join("\n");
    expect(message).toContain('"tokens.css", where canopy writes its design tokens');
    expect(message).toContain('"index.html", where canopy writes the page rendered from index.md');
    await expect(readdir(out)).rejects.toThrow();
  });
});

describe("canopy build --site-stylesheet", { timeout: RENDERS }, () => {
  // A stylesheet that lives in the vault is published where it is, so a
  // relative url() inside it resolves exactly as its author wrote it.
  it("links a published vault stylesheet at its own path, after carried ones", async () => {
    const { root, out } = await vault({
      "guide/page.md": "# Page\n",
      "theme/brand.css": "@font-face { font-family: B; src: url(fonts/b.woff2); }",
      "theme/fonts/b.woff2": "font",
    });
    await writeFile(path.join(root, "carried.css"), "a {}", "utf8");
    vi.spyOn(console, "log").mockImplementation(() => {});

    await runBuild([
      "build",
      path.join(root, "vault"),
      out,
      "--stylesheet",
      path.join(root, "carried.css"),
      "--site-stylesheet",
      "theme/brand.css",
    ]);

    expect(process.exitCode).toBeUndefined();
    expect(await readFile(path.join(out, "theme", "brand.css"), "utf8")).toContain("url(fonts/b.woff2)");
    expect(await readdir(path.join(out, "theme", "fonts"))).toContain("b.woff2");
    const page = await readFile(path.join(out, "guide", "page.html"), "utf8");
    expect(page.indexOf('href="../assets/stylesheet-1.css"')).toBeLessThan(
      page.indexOf('href="../theme/brand.css"'),
    );
  });

  it("fails naming the path when the stylesheet is not a published vault file", async () => {
    const { root, out } = await vault({ "index.md": "# Home\n" });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await runBuild(["build", path.join(root, "vault"), out, "--site-stylesheet", "theme/missing.css"]);

    expect(process.exitCode).toBe(1);
    expect(error.mock.calls.flat().join("\n")).toContain('--site-stylesheet: "theme/missing.css"');
  });
});

describe("canopy build — KaTeX", { timeout: RENDERS }, () => {
  it("puts the KaTeX stylesheet in the canopy layer, like canopy's own CSS", async () => {
    // A standalone $$..$$ line is display math (remark-math-subset.test.ts).
    const { root, out } = await vault({ "index.md": "# Home\n\n$$x^2$$\n" });
    vi.spyOn(console, "log").mockImplementation(() => {});

    await runBuild(["build", path.join(root, "vault"), out]);

    const katex = await readFile(path.join(out, "assets", "katex.css"), "utf8");
    expect(katex.startsWith("@layer canopy {\n")).toBe(true);
    expect(katex).not.toMatch(/@import|@charset/);
    expect(await readdir(path.join(out, "assets", "fonts"))).not.toHaveLength(0);
  });
});

describe("canopy build --layout", { timeout: RENDERS }, () => {
  async function layoutFile(root: string, layout: unknown): Promise<string> {
    const file = path.join(root, "layout.json");
    await writeFile(file, JSON.stringify(layout), "utf8");
    return file;
  }

  it("fills regions from vault fragments, writes a stream's index, and keeps fragments off the site", async () => {
    const { root, out } = await vault({
      "index.md": "# Home\n",
      "blog/post.md": "---\ndate: 2026-10-03\ncta: Try it\n---\n# Post\n",
      "partials/header.html": '<header class="host"><canopy-slot name="back"></canopy-slot></header>',
      "partials/cta.html": '<p><canopy-slot name="page:cta">Default</canopy-slot></p>',
    });
    const layout = await layoutFile(root, {
      dirs: {
        blog: {
          profile: "stream",
          title: "Blog",
          regions: { header: "partials/header.html", afterArticle: "partials/cta.html" },
        },
      },
    });
    vi.spyOn(console, "log").mockImplementation(() => {});

    await runBuild(["build", path.join(root, "vault"), out, "--layout", layout]);

    expect(process.exitCode).toBeUndefined();
    const post = await readFile(path.join(out, "blog", "post.html"), "utf8");
    expect(post).toContain('<header class="host"><a class="canopy-back" href="index.html">Blog</a></header>');
    expect(post).toContain('<div class="canopy-after-article"><p>Try it</p></div>');
    expect(await readFile(path.join(out, "blog", "index.html"), "utf8")).toContain("<h1>Blog</h1>");
    await expect(readFile(path.join(out, "partials", "header.html"), "utf8")).rejects.toThrow();
  });

  it("refuses a fragment with an unknown slot, naming the file", async () => {
    const { root, out } = await vault({
      "index.md": "# Home\n",
      "partials/header.html": '<canopy-slot name="nav"></canopy-slot>',
    });
    const layout = await layoutFile(root, { default: { regions: { header: "partials/header.html" } } });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await runBuild(["build", path.join(root, "vault"), out, "--layout", layout]);

    expect(process.exitCode).toBe(1);
    expect(error.mock.calls.map((call) => call[0]).join("\n")).toContain(
      '--layout: partials/header.html (header): unknown slot "nav"',
    );
  });

  it("refuses a missing fragment", async () => {
    const { root, out } = await vault({ "index.md": "# Home\n" });
    const layout = await layoutFile(root, { default: { regions: { footer: "partials/footer.html" } } });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await runBuild(["build", path.join(root, "vault"), out, "--layout", layout]);
    expect(process.exitCode).toBe(1);
    expect(error.mock.calls[0]?.[0]).toBe('--layout: region fragment "partials/footer.html" could not be read');
  });

  it("refuses a page whose frontmatter cannot fill a page slot", async () => {
    const { root, out } = await vault({
      "index.md": "---\ncta:\n  - a\n  - b\n---\n# Home\n",
      "partials/cta.html": '<canopy-slot name="page:cta"></canopy-slot>',
    });
    const layout = await layoutFile(root, { default: { regions: { afterArticle: "partials/cta.html" } } });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await runBuild(["build", path.join(root, "vault"), out, "--layout", layout]);
    expect(process.exitCode).toBe(1);
    expect(error.mock.calls[0]?.[0]).toBe(
      '--layout: index.md: frontmatter "cta" must be text to fill <canopy-slot name="page:cta">, not a list',
    );
  });

  it("refuses a layout file it cannot parse, naming it", async () => {
    const { root, out } = await vault({ "index.md": "# Home\n" });
    const layout = await layoutFile(root, { default: { profile: "garden" } });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await runBuild(["build", path.join(root, "vault"), out, "--layout", layout]);
    expect(process.exitCode).toBe(1);
    expect(error.mock.calls[0]?.[0]).toBe(`--layout ${layout}: default.profile: must be one of manual, stream`);
  });
});

describe("canopy build --color-scheme", { timeout: RENDERS }, () => {
  it("draws the site in its one scheme and says so when a fragment places a toggle", async () => {
    const { root, out } = await vault({
      "index.md": "# Home\n",
      "partials/header.html": '<header><canopy-slot name="theme-toggle"></canopy-slot></header>',
    });
    await writeFile(
      path.join(root, "layout.json"),
      JSON.stringify({ default: { regions: { header: "partials/header.html" } } }),
      "utf8",
    );
    vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await runBuild([
      "build",
      path.join(root, "vault"),
      out,
      "--color-scheme",
      "dark",
      "--layout",
      path.join(root, "layout.json"),
    ]);

    expect(process.exitCode).toBeUndefined();
    expect(await readFile(path.join(out, "index.html"), "utf8")).toContain('data-theme="dark"');
    expect(warn.mock.calls.flat().join("\n")).toContain(
      "--color-scheme dark: partials/header.html places the theme-toggle slot",
    );
  });
});
