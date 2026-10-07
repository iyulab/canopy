import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COMMAND_OPTIONS, USAGE } from "./cli-args.js";

/**
 * The README and the usage text, checked against the options the parser
 * actually accepts.
 *
 * An option the parser takes but neither document names is one nobody finds; a
 * synopsis that leaves an option out tells a reader the command has no such
 * thing. Both have drifted before — a `list` option added to the parser and the
 * usage text but not to the README's synopsis — and nothing failed.
 */

const README = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "README.md");

/** The options a text names, as whole words (`--site-url`, not the `--site` inside it). */
function named(text: string, options: readonly string[]): Set<string> {
  return new Set(
    options.filter((option) => new RegExp(`(^|[^\\w-])${option}(?![\\w-])`).test(text)),
  );
}

/** The line of `text` that starts the synopsis of a command (`canopy list <vault-dir> …`). */
function synopsis(text: string, command: string): string {
  return text.split(/\r?\n/).find((line) => line.trimStart().startsWith(`canopy ${command} <`)) ?? "";
}

describe("documentation of the CLI options", () => {
  it("names every option the parser accepts in the usage text", () => {
    for (const options of Object.values(COMMAND_OPTIONS)) {
      expect(options.filter((option) => !named(USAGE, options).has(option))).toEqual([]);
    }
  });

  it("names every option the parser accepts in the README", async () => {
    const readme = await readFile(README, "utf8");
    for (const options of Object.values(COMMAND_OPTIONS)) {
      expect(options.filter((option) => !named(readme, options).has(option))).toEqual([]);
    }
  });

  it("lists every option of `list` in its synopsis, in the usage text and in the README", async () => {
    const readme = await readFile(README, "utf8");
    const options = COMMAND_OPTIONS.list;
    expect(options.length).toBeGreaterThan(0);
    expect(options.filter((option) => !named(synopsis(USAGE, "list"), options).has(option))).toEqual([]);
    expect(options.filter((option) => !named(synopsis(readme, "list"), options).has(option))).toEqual([]);
  });
});
