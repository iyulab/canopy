#!/usr/bin/env node
import path from "node:path";
import { readFile } from "node:fs/promises";
import { listVault } from "./fs-bundle.js";
import { parseListArgs, requestedInfo, USAGE } from "./cli-args.js";

/**
 * `canopy list`: what `build` would publish, without building it.
 *
 * stdout carries the answer and nothing else — a caller parses it — so a
 * vault that cannot be read is reported on stderr with a failing exit code.
 */
async function list(): Promise<void> {
  const args = parseListArgs(process.argv.slice(2));
  if (!args.ok) {
    console.error(args.error);
    process.exitCode = 1;
    return;
  }
  const listing = await listVault(path.resolve(args.vault), args.exclude);
  if (args.json) {
    console.log(JSON.stringify(listing));
    return;
  }
  for (const file of [...listing.pages, ...listing.assets].sort()) {
    console.log(file);
  }
  for (const pattern of listing.unusedExcludes) {
    console.error(`canopy: --exclude ${pattern} matched nothing`);
  }
}

async function main(): Promise<void> {
  const info = requestedInfo(process.argv.slice(2));
  if (info === "help") {
    console.log(USAGE);
    return;
  }
  if (info === "version") {
    const manifest = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version: string };
    console.log(`canopy ${manifest.version}`);
    return;
  }

  if (process.argv[2] === "list") {
    await list();
    return;
  }

  const { runBuild } = await import("./cli-build.js");
  await runBuild(process.argv.slice(2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
