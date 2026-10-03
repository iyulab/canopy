import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runList } from "./cli-list.js";

const temporary: string[] = [];

async function vault(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "canopy-cli-list-"));
  temporary.push(root);
  for (const [rel, content] of Object.entries(files)) {
    await mkdir(path.join(root, path.dirname(rel)), { recursive: true });
    await writeFile(path.join(root, rel), content, "utf8");
  }
  return root;
}

afterEach(async () => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
  await Promise.all(temporary.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("canopy list --layout", () => {
  it("keeps fragments out of the listing and names the index pages a build will write", async () => {
    const root = await vault({
      "blog/a.md": "# A\n",
      "partials/header.html": "<header></header>",
      "logo.svg": "<svg></svg>",
    });
    const layoutPath = path.join(root, "..", `${path.basename(root)}-layout.json`);
    temporary.push(layoutPath);
    await writeFile(
      layoutPath,
      JSON.stringify({ dirs: { blog: { profile: "stream", regions: { header: "partials/header.html" } } } }),
      "utf8",
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await runList(["list", root, "--layout", layoutPath, "--json"]);

    expect(process.exitCode).toBeUndefined();
    expect(JSON.parse(log.mock.calls[0]?.[0] as string)).toEqual({
      pages: ["blog/a.md"],
      assets: ["logo.svg"],
      unusedExcludes: [],
      generated: ["blog/index.html"],
    });
  });

  it("reports no generated pages without a layout", async () => {
    const root = await vault({ "a.md": "# A\n" });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await runList(["list", root, "--json"]);
    expect(JSON.parse(log.mock.calls[0]?.[0] as string).generated).toEqual([]);
  });

  it("refuses a layout it cannot parse, naming the file", async () => {
    const root = await vault({ "a.md": "# A\n" });
    const layoutPath = path.join(root, "layout.json");
    await writeFile(layoutPath, '{"default":{"profile":"garden"}}', "utf8");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await runList(["list", root, "--layout", layoutPath, "--json"]);
    expect(process.exitCode).toBe(1);
    expect(error.mock.calls[0]?.[0]).toContain("default.profile: must be one of manual, stream");
  });
});
