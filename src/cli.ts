#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { requestedInfo, USAGE } from "./cli-args.js";

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
    const { runList } = await import("./cli-list.js");
    await runList(process.argv.slice(2));
    return;
  }

  const { runBuild } = await import("./cli-build.js");
  await runBuild(process.argv.slice(2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
