import type { RenderedPage } from "./contract.js";
import type { NavNode } from "./navigation.js";
import { frontmatterDate, pageDate } from "./page-date.js";
import { pageTitle } from "./shell.js";
import { fileUrl, pageUrl } from "./site-path.js";

/**
 * Atom feeds (RFC 4287) of a folder's dated pages — what lets a reader follow a
 * part of the site that grows by adding pages, instead of revisiting it.
 *
 * A feed is a projection of what the pages already say about themselves: their
 * name (the same `pageTitle` the tab and sidebar use), their `date:` and
 * `updated:`, their own `description:`. Nothing is inferred — a page with no
 * `date:` is not an entry, and a folder with no dated page has no feed, since
 * an Atom feed must say when it was last updated and canopy has no clock to
 * ask (the same input always yields the same output).
 */

/** A folder as a feed names it: vault-relative, no leading/trailing slash, "" for the root. */
export function normalizeFeedDir(dir: string): string {
  const posix = dir.replace(/\\/g, "/").replace(/^\.\/?/, "").replace(/^\/+|\/+$/g, "");
  return posix === "." ? "" : posix;
}

/** Where a folder's feed is published: `<dir>/feed.xml`, or `feed.xml` for the root. */
export function feedPath(dir: string): string {
  return dir === "" ? "feed.xml" : `${dir}/feed.xml`;
}

/** The page that fronts a folder — `<dir>/index.html`, or the site's own front page. */
function indexSitePath(dir: string): string {
  return dir === "" ? "index.html" : `${dir}/index.html`;
}

function isUnder(sitePath: string, dir: string): boolean {
  return dir === "" || sitePath.toLowerCase().startsWith(`${dir.toLowerCase()}/`);
}

/**
 * The pages a folder's feed lists: every page beneath it that is dated
 * (`pageDate`), newest first — except the page that fronts the folder, which
 * describes the series rather than being one of its entries.
 */
export function datedPagesUnder(pages: readonly RenderedPage[], dir: string): RenderedPage[] {
  const front = indexSitePath(dir).toLowerCase();
  return pages
    .filter((page) => isUnder(page.sitePath, dir) && page.sitePath.toLowerCase() !== front)
    .map((page) => ({ page, at: atomDate(pageDate(page)) }))
    .filter((entry): entry is { page: RenderedPage; at: string } => entry.at !== undefined)
    .sort(
      (a, b) =>
        Date.parse(b.at) - Date.parse(a.at) || a.page.sitePath.localeCompare(b.page.sitePath),
    )
    .map((entry) => entry.page);
}

/**
 * An ISO date or date-time in the exact form Atom requires (RFC 3339): a full
 * time with seconds and an explicit offset. A bare day is that day's start in
 * UTC; a time with no offset is read as UTC rather than as the build machine's
 * local time, which would make the output depend on where it was built.
 */
export function atomDate(iso: string | undefined): string | undefined {
  if (iso === undefined) return undefined;
  const match =
    /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/i.exec(iso);
  if (match === null) return undefined;
  const [, day, hour = "00", minute = "00", second = "00", fraction = "", offset = "Z"] = match;
  const zone = offset.toUpperCase() === "Z" ? "Z" : offset.replace(/^([+-]\d{2}):?(\d{2})$/, "$1:$2");
  return `${day}T${hour}:${minute}:${second}${fraction}${zone}`;
}

/**
 * What a folder's feed is called — the name the site already gives that folder:
 * its index page's name, else the label the navigation shows for it, else the
 * folder's own name. The root's feed is the site's.
 */
export function feedTitle(
  pages: readonly RenderedPage[],
  navigation: readonly NavNode[],
  dir: string,
  siteTitle: string | undefined,
): string {
  if (dir === "") return siteTitle ?? "Feed";
  const front = indexSitePath(dir).toLowerCase();
  const index = pages.find((page) => page.sitePath.toLowerCase() === front);
  const name = index !== undefined ? pageTitle(index) : (navLabel(navigation, dir) ?? dir.split("/").pop() ?? dir);
  return siteTitle === undefined || siteTitle === name ? name : `${name} · ${siteTitle}`;
}

/** Every page a navigation node leads to, itself included. */
function sitePathsOf(node: NavNode): string[] {
  return [...(node.sitePath === undefined ? [] : [node.sitePath]), ...node.children.flatMap(sitePathsOf)];
}

/**
 * The label of the shallowest link-less navigation group whose pages all sit
 * inside `dir` — how a folder with no index page is named in the sidebar.
 */
function navLabel(nodes: readonly NavNode[], dir: string): string | undefined {
  for (const node of nodes) {
    const paths = sitePathsOf(node);
    if (node.sitePath === undefined && paths.length > 0 && paths.every((p) => isUnder(p, dir))) {
      return node.label;
    }
  }
  for (const node of nodes) {
    const found = navLabel(node.children, dir);
    if (found !== undefined) return found;
  }
  return undefined;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

/**
 * The Atom document for a folder's dated pages, or `undefined` when it has none.
 *
 * Ids and links are absolute, as Atom requires, which is why a feed needs the
 * site's published URL. An entry's summary is the page's own `description:`
 * only — the site-wide fallback would make every entry say the same thing.
 */
export function renderFeed(
  pages: readonly RenderedPage[],
  navigation: readonly NavNode[],
  dir: string,
  options: { siteUrl: string; siteTitle?: string; lang?: string },
): string | undefined {
  const entries = datedPagesUnder(pages, dir);
  if (entries.length === 0) return undefined;

  const rendered = entries.map((page) => {
    const url = pageUrl(options.siteUrl, page.sitePath);
    const published = atomDate(pageDate(page)) as string;
    const updated = atomDate(frontmatterDate(page.frontmatter.updated)) ?? published;
    const author = nonEmpty(page.frontmatter.author);
    const summary = nonEmpty(page.frontmatter.description);
    return {
      updated,
      xml:
        "<entry>" +
        `<title>${escapeXml(pageTitle(page))}</title>` +
        `<link rel="alternate" type="text/html" href="${escapeXml(url)}"/>` +
        `<id>${escapeXml(url)}</id>` +
        `<published>${published}</published>` +
        `<updated>${updated}</updated>` +
        (author === undefined ? "" : `<author><name>${escapeXml(author)}</name></author>`) +
        (summary === undefined ? "" : `<summary>${escapeXml(summary)}</summary>`) +
        "</entry>",
    };
  });
  // The feed changed when its most recently changed entry did.
  const feedUpdated = rendered.reduce((latest, entry) =>
    Date.parse(entry.updated) > Date.parse(latest.updated) ? entry : latest,
  ).updated;

  const title = feedTitle(pages, navigation, dir, options.siteTitle);
  const self = fileUrl(options.siteUrl, feedPath(dir));
  const front = indexSitePath(dir).toLowerCase();
  // The root always has a front page (canopy synthesizes one); a folder only
  // when it has an index page of its own — a link to a folder URL that serves
  // nothing would send a feed reader's "visit site" to a 404.
  const hasFront = dir === "" || pages.some((page) => page.sitePath.toLowerCase() === front);
  const lang = options.lang ?? "en";
  return (
    '<?xml version="1.0" encoding="utf-8"?>\n' +
    `<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${escapeXml(lang)}">` +
    `<title>${escapeXml(title)}</title>` +
    `<id>${escapeXml(self)}</id>` +
    `<link rel="self" type="application/atom+xml" href="${escapeXml(self)}"/>` +
    (hasFront
      ? `<link rel="alternate" type="text/html" href="${escapeXml(pageUrl(options.siteUrl, indexSitePath(dir)))}"/>`
      : "") +
    `<updated>${feedUpdated}</updated>` +
    // Atom requires an author for the feed unless every entry names one; the
    // site is the honest author of the collection as a whole.
    `<author><name>${escapeXml(options.siteTitle ?? title)}</name></author>` +
    '<generator uri="https://github.com/iyulab/canopy">canopy</generator>' +
    rendered.map((entry) => entry.xml).join("") +
    "</feed>\n"
  );
}
