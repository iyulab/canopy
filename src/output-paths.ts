import { feedPath, normalizeFeedDir } from "./feed.js";
import { KATEX_STYLESHEET } from "./katex.js";
import { type Layout, streamPagePaths, syntheticIndexPaths } from "./layout.js";
import { toSitePath } from "./site-path.js";
import { callerStylesheetPath } from "./stylesheets.js";

/**
 * The paths canopy writes into a site itself, and the vault files that would
 * land on one of them.
 *
 * A build writes its own files and copies the vault's published files beside
 * them, into one output tree. A vault file at a path canopy also writes would
 * overwrite canopy's file or be overwritten by it, depending on write order —
 * either way something the author or canopy put there is silently gone (a
 * vault `tokens.css` takes the place of canopy's design tokens). So every such
 * path is reserved, and a vault publishing a file there is refused, by one rule
 * rather than one check per output.
 *
 * What is reserved depends only on how canopy is invoked and on which pages
 * exist — not on what the pages contain. KaTeX's files are reserved whether or
 * not the site has math yet, so adding the first formula never turns a sound
 * site into a broken one.
 */

/** What a build is asked to write, as far as output paths go. */
export interface OutputPlan {
  /** Vault-relative markdown pages, as `listVault` gives them. */
  pages: readonly string[];
  /** How many `--stylesheet` files are carried into `assets/`. */
  stylesheets?: number;
  /** Whether a `--script` is carried into `assets/`. */
  script?: boolean;
  /** `--search-index` output path, when one is written. */
  searchIndexPath?: string;
  /** `--feed` folders. */
  feeds?: readonly string[];
  /** The layout, whose stream folders may get a generated index page. */
  layout?: Layout;
}

/** Which of canopy's outputs a path belongs to. */
export type OutputOwner =
  | { kind: "tokens" }
  | { kind: "styles" }
  | { kind: "katex" }
  | { kind: "stylesheet"; index: number }
  | { kind: "script" }
  | { kind: "search-index" }
  | { kind: "feed"; dir: string }
  | { kind: "page"; page: string }
  | { kind: "stream-index"; dir: string }
  /** A later page of a stream's list (`<dir>/page/<n>.html`). */
  | { kind: "stream-page"; dir: string; page: number };

/** A published vault file at a path canopy writes itself. */
export interface OutputCollision {
  /** The vault file, as published. */
  path: string;
  owner: OutputOwner;
}

/** KaTeX's stylesheet, and the fonts it loads from `fonts/` beside it — every one named `KaTeX_*`. */
const KATEX_FONT_PREFIX = "assets/fonts/katex_";

/** Every published vault file that would land on a path canopy writes, in the order given. */
export function outputCollisions(published: readonly string[], plan: OutputPlan): OutputCollision[] {
  const owners = new Map<string, OutputOwner>();
  const reserve = (sitePath: string, owner: OutputOwner): void => {
    const key = sitePath.toLowerCase();
    if (!owners.has(key)) owners.set(key, owner);
  };
  reserve("tokens.css", { kind: "tokens" });
  reserve("styles.css", { kind: "styles" });
  reserve(KATEX_STYLESHEET, { kind: "katex" });
  for (let index = 0; index < (plan.stylesheets ?? 0); index++) {
    reserve(callerStylesheetPath(index), { kind: "stylesheet", index });
  }
  if (plan.script) reserve("assets/script.js", { kind: "script" });
  if (plan.searchIndexPath !== undefined) {
    reserve(plan.searchIndexPath.replace(/\\/g, "/").replace(/^\/+/, ""), { kind: "search-index" });
  }
  for (const dir of new Set((plan.feeds ?? []).map(normalizeFeedDir))) {
    reserve(feedPath(dir), { kind: "feed", dir });
  }
  const sitePaths = plan.pages.map(toSitePath);
  for (const [index, page] of plan.pages.entries()) {
    reserve(sitePaths[index] as string, { kind: "page", page });
  }
  for (const sitePath of syntheticIndexPaths(plan.layout, sitePaths)) {
    reserve(sitePath, { kind: "stream-index", dir: sitePath.replace(/\/?index\.html$/i, "") });
  }
  const collisions: OutputCollision[] = [];
  for (const sitePath of streamPagePaths(plan.layout, sitePaths)) {
    const [, dir = "", page = "0"] = /^(?:(.*)\/)?page\/(\d+)\.html$/i.exec(sitePath) ?? [];
    const owner: OutputOwner = { kind: "stream-page", dir, page: Number(page) };
    reserve(sitePath, owner);
    // A page of the vault's own at that path is not a file copied over it but a
    // page rendered to the same place — the same loss, from the other side.
    const index = sitePaths.findIndex((candidate) => candidate.toLowerCase() === sitePath.toLowerCase());
    if (index !== -1) collisions.push({ path: plan.pages[index] as string, owner });
  }

  for (const file of published) {
    const key = file.toLowerCase();
    const owner = owners.get(key) ?? (key.startsWith(KATEX_FONT_PREFIX) ? { kind: "katex" as const } : undefined);
    if (owner !== undefined) collisions.push({ path: file, owner });
  }
  return collisions;
}
