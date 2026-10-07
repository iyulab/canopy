import path from "node:path";
import { pathToFileURL } from "node:url";
import { mkdir, copyFile, readdir, readFile, writeFile } from "node:fs/promises";
import type { PluggableList } from "unified";
import { build } from "./index.js";
import { emitSite } from "./emit.js";
import { datedPagesUnder, normalizeFeedDir } from "./feed.js";
import { parseNavSpec, type NavSpec } from "./nav-spec.js";
import {
  copyFiles,
  listVault,
  outputExclusion,
  outputIsVaultMessage,
  readDocuments,
  writeFiles,
} from "./fs-bundle.js";
import { parseBuildArgs } from "./cli-args.js";
import { bundleUsesKatex, KATEX_STYLESHEET } from "./katex.js";
import { katexDirOfRenderer } from "./katex-assets.js";
import { inCanopyLayer } from "./stylesheets.js";
import { type OutputOwner, outputCollisions } from "./output-paths.js";
import { featuredProblems, type Layout, layoutFragments, parseLayout } from "./layout.js";
import { fragmentControls, fragmentProblems, pageSlotProblems } from "./regions.js";
import { parseFrontmatter } from "./frontmatter.js";
import { toSitePath } from "./site-path.js";
import { streamTagPaths, tagProblems } from "./tags.js";

/**
 * `canopy build`. Kept out of `cli.ts` so the rendering pipeline it pulls in
 * (unified, Shiki, KaTeX) is loaded only when a build actually runs — `list`
 * and `--help` would otherwise pay seconds of module loading to print a few
 * lines.
 */

/**
 * A relative or absolute filesystem path, as opposed to a bare package
 * specifier ("rehype-declart") that Node resolves through node_modules.
 * Matches Node's own distinction for import specifiers: "./x", "../x", "/x",
 * and a Windows drive-qualified path ("C:\x", "C:/x") are paths; everything
 * else is bare.
 */
function isFilesystemSpecifier(specifier: string): boolean {
  return (
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith("/") ||
    /^[a-zA-Z]:[/\\]/.test(specifier)
  );
}

/**
 * Load `--rehype-plugin` module specifiers into a rehype plugin list.
 *
 * Each module's default export is used directly as a unified plugin — the
 * same shape `.use()` already accepts for katex and Shiki internally, so a
 * caller writes a plugin exactly the way any other unified/rehype plugin is
 * written, with no canopy-specific wrapper.
 *
 * A filesystem path is resolved against the CLI's own working directory and
 * turned into a file URL before `import()`: a bare relative path like
 * "./my-plugin.js" is CLI-argument-relative (the caller's cwd), not
 * module-relative, and only an absolute file URL disambiguates that on every
 * platform. A bare package specifier ("rehype-declart") is passed to
 * `import()` unresolved, exactly as written — Node's own resolution walks up
 * from canopy's own install location to find it in the caller's
 * node_modules, the normal way any installed dependency resolves.
 */
async function loadRehypePlugins(specifiers: readonly string[]): Promise<PluggableList> {
  const plugins: PluggableList = [];
  for (const specifier of specifiers) {
    const resolved = isFilesystemSpecifier(specifier)
      ? pathToFileURL(path.resolve(specifier)).href
      : specifier;
    const mod: unknown = await import(resolved);
    const plugin = (mod as { default?: unknown }).default;
    if (typeof plugin !== "function") {
      throw new Error(
        `--rehype-plugin ${specifier}: module has no default export (expected a unified plugin function)`,
      );
    }
    plugins.push(plugin as PluggableList[number]);
  }
  return plugins;
}

/**
 * Copy KaTeX's stylesheet and woff2 fonts into the output so math renders
 * fully (the render core emits KaTeX HTML; this supplies its presentation).
 * The CSS references `fonts/...` relative to itself, so it sits beside them.
 */
async function copyKatexAssets(outDir: string): Promise<void> {
  const katexDir = katexDirOfRenderer();
  const assetsDir = path.join(outDir, "assets");
  const fontsOut = path.join(assetsDir, "fonts");
  await mkdir(fontsOut, { recursive: true });
  // Into canopy's layer like the rest of canopy's CSS, so a caller stylesheet
  // can restyle math the same way it restyles anything else. KaTeX's
  // stylesheet carries no @import/@charset (cli-build.test.ts checks the copy).
  await writeFile(
    path.join(assetsDir, "katex.css"),
    inCanopyLayer(await readFile(path.join(katexDir, "dist", "katex.min.css"), "utf8")),
    "utf8",
  );
  const fontsDir = path.join(katexDir, "dist", "fonts");
  for (const font of await readdir(fontsDir)) {
    if (font.endsWith(".woff2")) {
      await copyFile(path.join(fontsDir, font), path.join(fontsOut, font));
    }
  }
}

/** What canopy writes at a reserved path, in the CLI's own terms. */
function describeOwner(owner: OutputOwner): string {
  switch (owner.kind) {
    case "tokens":
      return "its design tokens";
    case "styles":
      return "its layout stylesheet";
    case "katex":
      return "KaTeX's stylesheet and fonts";
    case "stylesheet":
      return `the --stylesheet given ${ordinal(owner.index)}`;
    case "script":
      return "the --script";
    case "search-index":
      return "the --search-index";
    case "feed":
      return `the --feed for ${owner.dir || "."}`;
    case "page":
      return `the page rendered from ${owner.page}`;
    case "stream-index":
      return `the index page of stream folder ${owner.dir || "."}`;
    case "stream-page":
      return `page ${owner.page} of stream folder ${owner.dir || "."}'s list`;
    case "stream-tags":
      return `the tag page ${owner.path}`;
  }
}

function ordinal(index: number): string {
  return ["first", "second", "third"][index] ?? `${index + 1}th`;
}

export async function runBuild(argv: string[]): Promise<void> {
  const args = parseBuildArgs(argv);
  if (!args.ok) {
    console.error(args.error);
    process.exitCode = 1;
    return;
  }

  const vault = path.resolve(args.vault);
  const outDir = path.resolve(args.out);

  // The output is never input (see `outputExclusion`).
  const ownOutput = outputExclusion(vault, outDir);
  if (ownOutput === undefined) {
    console.error(outputIsVaultMessage(args.out));
    process.exitCode = 1;
    return;
  }

  // The layout and every fragment it names are read and checked before
  // anything else, so a slot that cannot be filled fails the build naming the
  // file — not halfway through writing the site.
  let layout: Layout | undefined;
  const fragments: Record<string, string> = {};
  if (args.layoutPath !== undefined) {
    try {
      layout = parseLayout(await readFile(path.resolve(args.layoutPath), "utf8"));
    } catch (error) {
      console.error(`--layout ${args.layoutPath}: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
      return;
    }
    for (const fragment of layoutFragments(layout)) {
      let html: string;
      try {
        html = await readFile(path.join(vault, fragment.path), "utf8");
      } catch {
        console.error(`--layout: region fragment "${fragment.path}" could not be read`);
        process.exitCode = 1;
        return;
      }
      const problems = fragment.regions.flatMap((region) =>
        fragmentProblems(html, region).map((problem) => `${fragment.path} (${region}): ${problem}`),
      );
      if (problems.length > 0) {
        for (const problem of problems) console.error(`--layout: ${problem}`);
        process.exitCode = 1;
        return;
      }
      fragments[fragment.path] = html;
    }
    // A whole-site stream with no front page of its own gets one written, and
    // that page is the site's contents page in a stream's shape: without a
    // title of its own it is named as the contents page is.
    const indexTitle = args.strings?.indexTitle;
    if (layout.default?.profile === "stream" && layout.default.title === undefined && indexTitle !== undefined) {
      layout = { ...layout, default: { ...layout.default, title: indexTitle } };
    }
  }

  // Carried like --script: canopy never interprets a caller's CSS, only writes
  // it to assets/ and links it after its own, in the order given.
  const styles: string[] = [];
  for (const stylesheetPath of args.stylesheetPaths) {
    try {
      styles.push(await readFile(path.resolve(stylesheetPath), "utf8"));
    } catch {
      console.error(`--stylesheet: "${stylesheetPath}" could not be read`);
      process.exitCode = 1;
      return;
    }
  }

  // Carried unread past this point — canopy neither runs nor inspects it, only
  // writes it to assets/ and links it (see docs/SCOPE.md, "Author client-side code").
  let script: string | undefined;
  if (args.scriptPath !== undefined) {
    try {
      script = await readFile(path.resolve(args.scriptPath), "utf8");
    } catch {
      console.error(`--script: "${args.scriptPath}" could not be read`);
      process.exitCode = 1;
      return;
    }
  }

  // All of these are copied by the asset pass, so they have to survive `--exclude` and
  // actually exist. Checking here turns a silently-broken tag — which only shows
  // up as a missing image after deploy — into a build failure naming the path.
  //
  // One walk of the vault answers this, the pages rendered, and the assets
  // copied, so the three cannot disagree about what the site publishes.
  // A fragment is read into the pages it fills, not published beside them.
  const listing = await listVault(vault, [...args.exclude, ...Object.keys(fragments), ...ownOutput]);
  const published = [...listing.pages, ...listing.assets];
  // Read before anything is written: a stream's tag pages come from its posts'
  // frontmatter, and both what they collide with and a tag that can have no
  // page are reasons to write nothing.
  const documents = await readDocuments(vault, listing.pages);
  const tagged = documents.map((doc) => ({
    sourcePath: doc.path,
    sitePath: toSitePath(doc.path),
    frontmatter: parseFrontmatter(doc.content).data,
  }));
  const badFeatured = featuredProblems(layout, listing.pages);
  if (badFeatured.length > 0) {
    for (const problem of badFeatured) console.error(`--layout ${args.layoutPath}: ${problem}`);
    process.exitCode = 1;
    return;
  }
  const badTags = tagProblems(layout, tagged);
  if (badTags.length > 0) {
    for (const { sitePath, message } of badTags) console.error(`canopy: ${sitePath}: ${message}`);
    process.exitCode = 1;
    return;
  }
  // canopy writes its own files into the same tree the vault's are copied to;
  // a vault file at one of those paths would replace canopy's or be replaced by
  // it, silently either way (see output-paths.ts).
  const collisions = outputCollisions(published, {
    pages: listing.pages,
    stylesheets: styles.length,
    script: script !== undefined,
    ...(args.searchIndexPath !== undefined ? { searchIndexPath: args.searchIndexPath } : {}),
    feeds: args.feeds,
    tagPaths: streamTagPaths(layout, tagged),
    ...(layout ? { layout } : {}),
  });
  if (collisions.length > 0) {
    for (const { path: file, owner } of collisions) {
      console.error(`canopy: the vault publishes "${file}", where canopy writes ${describeOwner(owner)} — rename or move it`);
    }
    process.exitCode = 1;
    return;
  }
  const siteStylesheets = args.siteStylesheets.map((value) =>
    value.replace(/\\/g, "/").replace(/^\/+/, ""),
  );
  for (const [flag, value] of [
    ["--site-icon", args.siteIcon],
    ["--site-logo", args.siteLogo],
    ["--site-image", args.siteImage],
    ...siteStylesheets.map((sheet) => ["--site-stylesheet", sheet] as const),
  ] as const) {
    if (value === undefined) continue;
    const rel = value.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!published.includes(rel)) {
      console.error(`${flag}: "${rel}" is not a published vault file (missing, or excluded)`);
      process.exitCode = 1;
      return;
    }
  }

  let nav: NavSpec | undefined;
  if (args.navPath !== undefined) {
    try {
      nav = parseNavSpec(await readFile(path.resolve(args.navPath), "utf8"));
    } catch (error) {
      // A spec is hand-edited, so a mistake in it is an authoring error: name the
      // file and the position rather than letting a half-applied order look like
      // canopy ignoring what it was given.
      console.error(
        `--nav ${args.navPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 1;
      return;
    }
  }

  let rehypePlugins: PluggableList | undefined;
  if (args.rehypePluginPaths.length > 0) {
    try {
      rehypePlugins = await loadRehypePlugins(args.rehypePluginPaths);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
      return;
    }
  }

  const bundle = await build({
    documents,
    ...(nav ? { nav } : {}),
    ...(rehypePlugins ? { rehypePlugins } : {}),
    ...(layout ? { layout } : {}),
  });

  const slotProblems = pageSlotProblems(bundle.pages, layout, fragments);
  if (slotProblems.length > 0) {
    for (const problem of slotProblems) console.error(`--layout: ${problem}`);
    process.exitCode = 1;
    return;
  }

  // A toggle on a site with one scheme has nothing to switch, so the slot shows
  // nothing; said here so a header's empty space is not a mystery.
  if (args.colorScheme !== undefined) {
    for (const [file, html] of Object.entries(fragments)) {
      if (fragmentControls(html).includes("theme-toggle")) {
        console.warn(
          `--color-scheme ${args.colorScheme}: ${file} places the theme-toggle slot, which shows nothing on a site with one scheme`,
        );
      }
    }
  }

  // Report rather than fail: an omitted page may be deliberate, and canopy does
  // not know which. Saying so is what keeps the omission from being silent.
  for (const missing of bundle.navReport?.missing ?? []) {
    console.warn(`--nav: "${missing}" matches no page`);
  }
  const unplaced = bundle.navReport?.unplaced ?? [];
  if (unplaced.length > 0) {
    console.warn(
      `--nav: ${unplaced.length} page(s) not in the spec, so not in the navigation: ${unplaced.join(", ")}`,
    );
  }

  // A feed is written from the folder's dated pages; one with none has nothing
  // to say and no honest update time, so it is skipped — say so, or a missing
  // feed.xml looks like canopy ignoring the flag.
  for (const dir of new Set(args.feeds.map(normalizeFeedDir))) {
    if (datedPagesUnder(bundle.pages, dir).length === 0) {
      console.warn(`--feed ${dir || "."}: no page there is dated (a date: or a file named by its day), so no feed is written`);
    }
  }

  // Gate KaTeX assets on actual usage: a math-free site would otherwise carry
  // the stylesheet + ~20 woff2 fonts as dead payload (often most of its bytes).
  const usesKatex = bundleUsesKatex(bundle);
  const stylesheets = ["tokens.css", "styles.css"];
  if (usesKatex) {
    stylesheets.push(KATEX_STYLESHEET);
  }

  // The icon path was validated above; copyFiles mirrors it into the output at
  // the same path, so the shell only needs to know where to point.
  const files = emitSite(bundle, {
    siteTitle: args.siteTitle ?? path.basename(vault),
    stylesheets,
    ...(styles.length > 0 ? { styles } : {}),
    ...(siteStylesheets.length > 0 ? { siteStylesheets } : {}),
    ...(script !== undefined ? { script } : {}),
    ...(args.lang ? { lang: args.lang } : {}),
    ...(args.colorScheme ? { colorScheme: args.colorScheme } : {}),
    ...(args.siteIcon ? { iconPath: args.siteIcon.replace(/\\/g, "/") } : {}),
    ...(args.siteDescription ? { description: args.siteDescription } : {}),
    ...(args.siteUrl ? { siteUrl: args.siteUrl } : {}),
    ...(args.siteImage ? { imagePath: args.siteImage.replace(/\\/g, "/") } : {}),
    ...(args.alternates ? { alternates: args.alternates } : {}),
    ...(args.siteLogo ? { logoPath: args.siteLogo.replace(/\\/g, "/") } : {}),
    ...(args.homeUrl ? { homeUrl: args.homeUrl } : {}),
    ...(args.homeLabel ? { homeLabel: args.homeLabel } : {}),
    ...(args.strings ? { strings: args.strings } : {}),
    ...(args.searchIndexPath ? { searchIndexPath: args.searchIndexPath } : {}),
    ...(args.feeds.length > 0 ? { feeds: args.feeds } : {}),
    ...(layout ? { layout, fragments } : {}),
  });

  await writeFiles(outDir, files);
  if (usesKatex) {
    await copyKatexAssets(outDir);
  }
  const assetCount = await copyFiles(vault, outDir, listing.assets);

  console.log(
    `canopy: ${bundle.pages.length} page(s), ${assetCount} asset(s) -> ${outDir}`,
  );
}

