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
