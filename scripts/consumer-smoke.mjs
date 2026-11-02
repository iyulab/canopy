#!/usr/bin/env node
// Installs canopy the way a consuming project does — from the packed tarball, into an empty project —
// and builds a page with math there.
//
// What only this can catch: anything that holds in this repository's own install and not in a
// consumer's. npm reads `overrides` from the installing project only, so a dependency pinned here can
// resolve differently there; a file missing from `files` is present here and absent there. The unit
// suite runs against this repository's node_modules and sees neither.
//
// Checks, in the consumer's install:
//   - the packed CLI runs and builds;
//   - the shipped KaTeX stylesheet is that of the KaTeX canopy itself declares;
//   - every class the rendered math uses is one that stylesheet styles (markup and stylesheet from
//     one KaTeX — a mismatch leaves published math unstyled).
//
// Run after `npm run build`. Exit 0 on success, 1 on a failed check.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(path.join(tmpdir(), "canopy-consumer-"));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: ["ignore", "pipe", "inherit"], shell: process.platform === "win32" }).toString();

/** `version` within a caret `range` (`^0.18.7`: 0.18.x from .7; `^1.2.3`: 1.x from 1.2.3). */
function satisfiesCaret(version, range) {
  const [vMaj, vMin, vPat] = version.split(/[.-]/).map(Number);
  const match = /^\^(\d+)\.(\d+)\.(\d+)$/.exec(range ?? "");
  if (match === null) throw new Error(`cannot read katex range "${range}" (expected ^x.y.z)`);
  const [rMaj, rMin, rPat] = match.slice(1).map(Number);
  if (vMaj !== rMaj) return false;
  if (rMaj === 0 && vMin !== rMin) return false;
  if (vMin !== rMin) return vMin > rMin;
  return vPat >= rPat;
}

function fail(message) {
  console.error(`consumer-smoke: ${message}`);
  process.exitCode = 1;
}

try {
  run(npm, ["pack", "--silent", "--pack-destination", work], repo);
  const tarball = readdirSync(work).find((name) => name.endsWith(".tgz"));
  if (tarball === undefined) throw new Error("npm pack wrote no tarball");

  const consumer = path.join(work, "consumer");
  mkdirSync(path.join(consumer, "vault"), { recursive: true });
  writeFileSync(path.join(consumer, "package.json"), JSON.stringify({ name: "consumer", private: true }));
  run(npm, ["install", "--no-audit", "--no-fund", "--silent", path.join(work, tarball)], consumer);

  writeFileSync(
    path.join(consumer, "vault", "index.md"),
    "# Math\n\nInline $x^2 + \\frac{a}{b}$.\n\n$$\n\\sum_{i=1}^n i\n$$\n\n```math\n\\sqrt{2}\n```\n",
  );
  const cli = path.join(consumer, "node_modules", "@iyulab", "canopy", "dist", "cli.js");
  run(process.execPath, [cli, "build", "vault", "out"], consumer);

  // The stylesheet a site ships must be that of the KaTeX canopy declares — not of a copy some other
  // package's range brought in. (Markup and stylesheet from one stray copy agree with each other, so the
  // class check below cannot see that on its own.)
  const installed = path.join(consumer, "node_modules", "@iyulab", "canopy");
  const declared = JSON.parse(readFileSync(path.join(installed, "package.json"), "utf8")).dependencies.katex;
  const own = path.dirname(createRequire(path.join(installed, "dist", "index.js")).resolve("katex/package.json"));
  const version = JSON.parse(readFileSync(path.join(own, "package.json"), "utf8")).version;
  if (!satisfiesCaret(version, declared)) fail(`canopy's own KaTeX is ${version}, outside its declared ${declared}`);
  const ownCss = readFileSync(path.join(own, "dist", "katex.min.css"), "utf8");
  const shipped = readFileSync(path.join(consumer, "out", "assets", "katex.css"), "utf8");
  if (!shipped.includes(ownCss)) fail(`the shipped katex.css is not the stylesheet of canopy's own KaTeX ${version}`);

  const html = readFileSync(path.join(consumer, "out", "index.html"), "utf8");
  const css = shipped;
  const formulas = html.match(/<span class="katex"/g)?.length ?? 0;
  if (formulas !== 3) fail(`expected 3 rendered formulas, found ${formulas}`);
  // KaTeX's atom classes name what a symbol is and `mtight` marks script size; no version styles them
  // on their own. Everything else the markup uses must be in the stylesheet that ships with it.
  const atoms = new Set(["mord", "mbin", "mrel", "mop", "mopen", "mclose", "mpunct", "minner", "mtight"]);
  const math = html.slice(html.indexOf('<span class="katex'));
  const classes = new Set([...math.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean));
  const unstyled = [...classes].filter((name) => !atoms.has(name) && !name.startsWith("canopy") && !css.includes(`.${name}`));
  if (unstyled.length > 0) fail(`rendered math uses classes the shipped stylesheet does not style: ${unstyled.join(", ")}`);
  if (process.exitCode !== 1) console.log(`consumer-smoke: ok — ${formulas} formulas, ${classes.size} classes, all styled`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  rmSync(work, { recursive: true, force: true });
}
