/**
 * Where each page stands in the site: the navigation profile that shapes it,
 * and the caller's own HTML fragments that fill its regions.
 *
 * A layout is a site default plus per-folder rules, the longest folder that
 * contains a page deciding for it — the shape a documentation site and a blog
 * inside one site both need, without a page ever naming its own profile. The
 * caller writes it (by hand, or generated from its own configuration); canopy
 * applies it and knows nothing about where it came from, the same contract the
 * navigation spec has.
 *
 * Kept free of rendering dependencies: `canopy list` reads a layout to know
 * which files are fragments rather than published assets, and which index
 * pages a build will write, and it must stay as quick as a directory walk.
 */

import { toSitePath } from "./site-path.js";

/** The ways a folder of pages can be read. `manual`: a tree to look things up in. `stream`: dated pages, newest first. */
export const PROFILES = ["manual", "stream"] as const;
export type Profile = (typeof PROFILES)[number];

/**
 * Where a caller's fragment can go. `header` and `footer` replace canopy's own
 * top bar and page end with the caller's markup; the others add to the page
 * (`head` before `</head>`, the two article regions at the start and the end
 * of the article).
 */
export const REGIONS = ["head", "header", "beforeArticle", "afterArticle", "footer"] as const;
export type RegionName = (typeof REGIONS)[number];

/** What one rule says about the pages it covers. Every field is optional; an unset one is inherited. */
export interface LayoutRule {
  profile?: Profile;
  /**
   * Title of the index page canopy writes for a stream folder that has none
   * of its own. Unused otherwise.
   */
  title?: string;
  /** Region → vault-relative path of the fragment that fills it. `""` turns an inherited region off. */
  regions?: Partial<Record<RegionName, string>>;
  /**
   * How many posts a stream folder's listing shows to a page — the index page
   * shows the newest, `page/2.html` the next, and so on. Only on a rule that
   * makes its folder a stream; `DEFAULT_PAGE_SIZE` when absent.
   */
  pageSize?: number;
  /**
   * Posts a stream folder puts first, by vault path, in this order: atop the
   * first page of its list and out of the dated pages after it, and after
   * whatever a post's own `readNext:` names in what to read next. Only on a
   * rule that makes its folder a stream.
   */
  featured?: string[];
}

/** Posts to a page of a stream's listing when its rule names no `pageSize`. */
export const DEFAULT_PAGE_SIZE = 10;

/** A site default and per-folder rules, keyed by vault-relative folder path. */
export interface Layout {
  default?: LayoutRule;
  dirs?: Record<string, LayoutRule>;
}

/** Why a layout was rejected, phrased for someone editing the file. */
export class LayoutError extends Error {}

function fail(message: string): never {
  throw new LayoutError(message);
}

function normalizeDir(dir: string): string {
  return dir.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+|\/+$/g, "");
}

function normalizePath(file: string): string {
  return file.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
}

function hasParentSegment(path: string): boolean {
  return path.split("/").includes("..");
}

/** A fragment's vault path, normalized — or a failure naming where it was written. */
function fragmentPath(file: string, where: string): string {
  const path = normalizePath(file);
  if (hasParentSegment(path)) fail(`${where}: "${file}" must not contain ".." — a fragment is inside the vault`);
  if (path === "" || path.endsWith("/")) fail(`${where}: "${file}" names no file`);
  if (/[*?[\]]/.test(path)) fail(`${where}: "${file}" must not contain any of * ? [ ] — it is one file, not a pattern`);
  return path;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateRule(value: unknown, where: string): LayoutRule {
  if (!isObject(value)) fail(`${where}: expected an object`);
  const { profile, title, regions, pageSize, featured, ...rest } = value;
  const unknown = Object.keys(rest)[0];
  if (unknown !== undefined) fail(`${where}: unknown key "${unknown}"`);
  if (profile !== undefined && !PROFILES.includes(profile as Profile)) {
    fail(`${where}.profile: must be one of ${PROFILES.join(", ")}`);
  }
  if (title !== undefined && (typeof title !== "string" || title.trim() === "")) {
    fail(`${where}.title: must be a non-empty string`);
  }
  if (pageSize !== undefined) {
    if (typeof pageSize !== "number" || !Number.isInteger(pageSize) || pageSize < 1) {
      fail(`${where}.pageSize: must be a whole number of at least 1`);
    }
    if (profile !== "stream") {
      fail(`${where}.pageSize: only a stream folder's listing is paged — this rule needs "profile": "stream"`);
    }
  }
  let parsedFeatured: string[] | undefined;
  if (featured !== undefined) {
    if (!Array.isArray(featured)) fail(`${where}.featured: expected a list of the posts' vault paths`);
    if (profile !== "stream") {
      fail(`${where}.featured: only a stream folder has posts to feature — this rule needs "profile": "stream"`);
    }
    parsedFeatured = featured.map((file, i) => {
      if (typeof file !== "string") fail(`${where}.featured[${i}]: must be a post's vault path`);
      const path = fragmentPath(file, `${where}.featured[${i}]`);
      if (!/\.md$/i.test(path)) fail(`${where}.featured[${i}]: "${file}" is not a markdown post`);
      return path;
    });
  }
  let parsedRegions: Partial<Record<RegionName, string>> | undefined;
  if (regions !== undefined) {
    if (!isObject(regions)) fail(`${where}.regions: expected an object of region → fragment path`);
    parsedRegions = {};
    for (const [name, file] of Object.entries(regions)) {
      if (!REGIONS.includes(name as RegionName)) {
        fail(`${where}.regions: unknown region "${name}" (regions: ${REGIONS.join(", ")})`);
      }
      if (typeof file !== "string") {
        fail(`${where}.regions.${name}: must be a vault path, or "" to turn the region off`);
      }
      parsedRegions[name as RegionName] = file === "" ? "" : fragmentPath(file, `${where}.regions.${name}`);
    }
  }
  return {
    ...(profile === undefined ? {} : { profile: profile as Profile }),
    ...(title === undefined ? {} : { title: title as string }),
    ...(parsedRegions === undefined ? {} : { regions: parsedRegions }),
    ...(pageSize === undefined ? {} : { pageSize: pageSize as number }),
    ...(parsedFeatured === undefined ? {} : { featured: parsedFeatured }),
  };
}

/**
 * Parse and validate a layout from JSON text.
 *
 * Strict, and every message names its position: a layout is hand-edited or
 * generated by someone else's code, and a rule that is silently half-applied
 * looks like canopy ignoring it.
 */
export function parseLayout(json: string): Layout {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    fail(`not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isObject(raw)) fail('expected an object with "default" and/or "dirs"');
  const { default: siteDefault, dirs, ...rest } = raw;
  const unknown = Object.keys(rest)[0];
  if (unknown !== undefined) fail(`unknown key "${unknown}"`);

  const layout: Layout = {};
  if (siteDefault !== undefined) layout.default = validateRule(siteDefault, "default");
  if (dirs !== undefined) {
    if (!isObject(dirs)) fail('"dirs": expected an object of folder → rule');
    const parsed: Record<string, LayoutRule> = {};
    for (const [dir, rule] of Object.entries(dirs)) {
      const key = normalizeDir(dir);
      if (hasParentSegment(key)) fail(`dirs: "${dir}" must not contain ".." — a folder is inside the vault`);
      if (key === "") fail(`dirs: "${dir}" names the whole site — that rule is "default"`);
      if (Object.keys(parsed).some((seen) => seen.toLowerCase() === key.toLowerCase())) {
        fail(`dirs: "${dir}" is given twice`);
      }
      parsed[key] = validateRule(rule, `dirs.${key}`);
    }
    layout.dirs = parsed;
  }
  return layout;
}

/** The rules that cover a site path, the site default first and longer folders after. */
function rulesFor(layout: Layout | undefined, sitePath: string): { dir: string; rule: LayoutRule }[] {
  const key = sitePath.toLowerCase();
  const rules = [{ dir: "", rule: layout?.default ?? {} }];
  for (const [dir, rule] of Object.entries(layout?.dirs ?? {})) {
    if (key.startsWith(`${dir.toLowerCase()}/`)) rules.push({ dir, rule });
  }
  return rules.sort((a, b) => a.dir.length - b.dir.length);
}

/** What applies to one page once every rule covering it has been taken into account. */
export interface PageLayout {
  profile: Profile;
  /**
   * The folder whose stream this page belongs to — the folder of the rule that
   * set its profile, spelled as in the page's own path, `""` for the site
   * default — or `undefined` for a manual page.
   */
  streamDir: string | undefined;
  /** Region → fragment path. A region turned off with `""` is absent. */
  regions: Partial<Record<RegionName, string>>;
}

/**
 * Resolve the layout for one page: the profile from the longest folder that
 * states one, regions merged key by key from the site default down.
 */
export function resolvePageLayout(layout: Layout | undefined, sitePath: string): PageLayout {
  let profile: Profile = "manual";
  let from = "";
  const regions: Partial<Record<RegionName, string>> = {};
  for (const { dir, rule } of rulesFor(layout, sitePath)) {
    if (rule.profile !== undefined) {
      profile = rule.profile;
      from = dir;
    }
    Object.assign(regions, rule.regions);
  }
  for (const name of REGIONS) {
    if (regions[name] === "") delete regions[name];
  }
  // In the page's own case: the rule matched its folder ignoring case, and a
  // path canopy writes from this has to lead to the folder as it is.
  return { profile, streamDir: profile === "stream" ? sitePath.slice(0, from.length) : undefined, regions };
}

/** Folders whose own rule makes them a stream, sorted; `""` when the site default does. */
export function streamDirs(layout: Layout | undefined): string[] {
  const dirs: string[] = [];
  if (layout?.default?.profile === "stream") dirs.push("");
  for (const [dir, rule] of Object.entries(layout?.dirs ?? {})) {
    if (rule.profile === "stream") dirs.push(dir);
  }
  return dirs.sort();
}

/** The site path of a stream folder's index page — the page that lists it. */
export function streamIndexPath(dir: string): string {
  return dir === "" ? "index.html" : `${dir}/index.html`;
}

/**
 * The index pages a build writes because a stream folder has none of its own.
 * A stream is read from its list, so a folder without a page to hold that list
 * would leave a reader nowhere to start.
 */
export function syntheticIndexPaths(layout: Layout | undefined, sitePaths: readonly string[]): string[] {
  const have = new Set(sitePaths.map((sitePath) => sitePath.toLowerCase()));
  return streamDirs(layout)
    .map((dir) => streamIndexPath(inSiteCase(dir, sitePaths)))
    .filter((sitePath) => !have.has(sitePath.toLowerCase()));
}

/**
 * The pages a stream folder's listing continues on past its index —
 * `<dir>/page/2.html`, `<dir>/page/3.html` … — one for every `pageSize` posts
 * after the first page's. Counted from paths alone (which pages the folder's
 * stream rule covers, its index aside), so a caller that has not rendered
 * anything — `list --json`, a link checker — names the same pages a build
 * writes. In the folder's own spelling, like its index page.
 */
export function streamPagePaths(layout: Layout | undefined, sitePaths: readonly string[]): string[] {
  const paths: string[] = [];
  for (const dir of streamDirs(layout)) {
    const index = streamIndexPath(dir).toLowerCase();
    // A featured post stands atop the first page, not in the dated pages.
    const featured = new Set(streamFeatured(layout, dir).map((sitePath) => sitePath.toLowerCase()));
    const posts = sitePaths.filter(
      (sitePath) =>
        sitePath.toLowerCase() !== index &&
        !featured.has(sitePath.toLowerCase()) &&
        resolvePageLayout(layout, sitePath).streamDir?.toLowerCase() === dir.toLowerCase(),
    ).length;
    const size = folderRule(layout, dir)?.pageSize ?? DEFAULT_PAGE_SIZE;
    const base = dir === "" ? "" : `${inSiteCase(dir, sitePaths)}/`;
    for (let page = 2; page <= Math.ceil(posts / size); page++) paths.push(`${base}page/${page}.html`);
  }
  return paths;
}

/**
 * Which page of its stream's listing a page is: 1 for the stream's index, `n`
 * for `<dir>/page/n.html` (from 2), undefined for anything else — a post, or a
 * page outside a stream.
 */
export function streamListingPage(sitePath: string, pageLayout: PageLayout): number | undefined {
  if (pageLayout.streamDir === undefined) return undefined;
  const key = sitePath.toLowerCase();
  if (key === streamIndexPath(pageLayout.streamDir).toLowerCase()) return 1;
  const base = pageLayout.streamDir === "" ? "" : `${pageLayout.streamDir.toLowerCase()}/`;
  const prefix = `${base}page/`;
  if (!key.startsWith(prefix) || !key.endsWith(".html")) return undefined;
  const number = key.slice(prefix.length, -".html".length);
  if (!/^[1-9][0-9]*$/.test(number)) return undefined;
  const page = Number(number);
  return page >= 2 ? page : undefined;
}

/**
 * A rule's folder as the site's own paths spell it. A rule matches its folder
 * ignoring case; the folder's pages say how it is actually written. A folder
 * with no pages has nothing to go by, and keeps the rule's spelling.
 */
function inSiteCase(dir: string, sitePaths: readonly string[]): string {
  if (dir === "") return dir;
  const prefix = `${dir.toLowerCase()}/`;
  const page = sitePaths.find((sitePath) => sitePath.toLowerCase().startsWith(prefix));
  return page === undefined ? dir : page.slice(0, dir.length);
}

/**
 * The site paths of the posts a stream folder features, in the order its rule
 * gives them — as written, to be matched ignoring case like every path here.
 */
export function streamFeatured(layout: Layout | undefined, dir: string): string[] {
  return (folderRule(layout, dir)?.featured ?? []).map(toSitePath);
}

/**
 * Featured entries that name no post of their stream — a file the site does not
 * publish, or one outside the folder, or its index — as messages naming the rule.
 */
export function featuredProblems(layout: Layout | undefined, sourcePaths: readonly string[]): string[] {
  const problems: string[] = [];
  for (const dir of streamDirs(layout)) {
    const where = dir === "" ? "default" : `dirs.${dir}`;
    const index = streamIndexPath(dir).toLowerCase();
    for (const file of folderRule(layout, dir)?.featured ?? []) {
      const sitePath = toSitePath(file).toLowerCase();
      const published = sourcePaths.some((source) => source.toLowerCase() === file.toLowerCase());
      const own = resolvePageLayout(layout, sitePath).streamDir?.toLowerCase() === dir.toLowerCase();
      if (!published) problems.push(`${where}.featured: "${file}" is not a page this site publishes`);
      else if (!own || sitePath === index) problems.push(`${where}.featured: "${file}" is not a post of this stream`);
    }
  }
  return problems;
}

/** The rule written for a folder, found ignoring case as every rule is matched; the site default for `""`. */
export function folderRule(layout: Layout | undefined, dir: string): LayoutRule | undefined {
  if (dir === "") return layout?.default;
  const key = dir.toLowerCase();
  return Object.entries(layout?.dirs ?? {}).find(([candidate]) => candidate.toLowerCase() === key)?.[1];
}

/**
 * Every fragment file a layout names, once, with the regions it fills — the
 * files a build reads instead of publishing, and checks once per region.
 */
export function layoutFragments(layout: Layout | undefined): { path: string; regions: RegionName[] }[] {
  const byPath = new Map<string, Set<RegionName>>();
  for (const rule of [layout?.default, ...Object.values(layout?.dirs ?? {})]) {
    for (const [name, file] of Object.entries(rule?.regions ?? {})) {
      if (file === "" || file === undefined) continue;
      const regions = byPath.get(file) ?? new Set<RegionName>();
      regions.add(name as RegionName);
      byPath.set(file, regions);
    }
  }
  return [...byPath.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([file, regions]) => ({ path: file, regions: REGIONS.filter((name) => regions.has(name)) }));
}
