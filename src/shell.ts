import type { RenderedPage, Backlink } from "./contract.js";
import { isExternalUrl } from "./markdown-link.js";
import { flattenNav, type NavNode } from "./navigation.js";
import { relativeHref } from "./site-path.js";
import { isOutlineUseful, type OutlineItem } from "./outline.js";
import { declaredTitle, pageName } from "./title.js";

/** Options controlling the site shell wrapped around each page. */
export interface ShellOptions {
  /** Site name, shown in the top bar and document title. */
  siteTitle?: string;
  /**
   * BCP 47 language tag for the <html lang> attribute. Defaults to "en".
   *
   * Worth setting for any non-English vault: assistive technology picks
   * pronunciation rules from it, and browsers use it for translation offers,
   * hyphenation, and font fallback. A page whose declared language is wrong is
   * an accessibility failure (WCAG 3.1.1), not a cosmetic one.
   */
  lang?: string;
  /**
   * Stylesheet site paths to link in <head>, resolved relative to each page.
   * Defaults to ["tokens.css", "styles.css"]; consumers can append e.g. a
   * KaTeX stylesheet.
   */
  stylesheets?: string[];
  /**
   * Site path of a favicon, linked from every page. Relative like every other
   * link, so the icon resolves when the site is served from a sub-path — which
   * is exactly where the browser's implicit `/favicon.ico` guess fails.
   */
  iconPath?: string;
  /** Site description for `<meta name="description">`, used by link previews. */
  description?: string;
  /**
   * Site path of a logo, shown beside the site title. Relative like every other
   * link, so it resolves when the site is served from a sub-path.
   *
   * Decorative: it renders with an empty `alt`, because the site title next to it
   * already names the site and a screen reader should not hear the name twice.
   */
  logoPath?: string;
  /**
   * URL of the site this documentation belongs beside — a product's own front
   * page. Left exactly as given: it usually points outside the published site,
   * which canopy has no way to resolve.
   */
  homeUrl?: string;
  /**
   * Link text for `homeUrl`. Required alongside it — link text has to be written
   * in the site's own language, and canopy cannot know what that language calls
   * a home page.
   */
  homeLabel?: string;
  /**
   * Render a hidden search form in the top bar. Set by `emitSite` whenever a
   * search index is requested — the index and the place to search from are
   * one feature, not two flags.
   *
   * Canopy writes no script (see docs/SCOPE.md), so the form starts `hidden`
   * and stays that way unless a caller-supplied script (`--script`) finds
   * `.canopy-search` and reveals it. `.canopy-search` is the entire contract:
   * a script depends on this documented element, never on the shell's
   * internal structure.
   */
  search?: boolean;
  /**
   * Site path of a caller-supplied script, linked `<script defer>` from every
   * page. Relative like every other link, so it resolves from a sub-path.
   *
   * Canopy neither reads nor writes this file's contents — it only carries
   * what a caller gives it (see docs/SCOPE.md, "Author client-side code").
   */
  scriptPath?: string;
  /**
   * Overrides for the reader chrome's own text — search, the theme toggle,
   * and the navigation landmarks. `lang` changes what `<html lang>` declares,
   * but these are canopy's own UI, not vault content, so `lang` alone leaves
   * them English; there is no built-in translation table, the same reasoning
   * `homeLabel` already applies. Unset keys keep their English default.
   */
  strings?: {
    search?: string;
    toggleTheme?: string;
    siteNav?: string;
    pageNav?: string;
    onThisPage?: string;
    /** Title and heading of the synthetic contents page `renderContentsPage` emits. */
    indexTitle?: string;
    /** Heading over a page's list of pages that link to it. */
    backlinks?: string;
  };
}

const DEFAULT_STRINGS = {
  search: "Search",
  toggleTheme: "Toggle color theme",
  siteNav: "Site navigation",
  pageNav: "Page navigation",
  onThisPage: "On this page",
  indexTitle: "Contents",
  backlinks: "Linked references",
} as const;

/** MIME type for a favicon, inferred from its extension. */
function iconType(sitePath: string): string | undefined {
  const ext = sitePath.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  switch (ext) {
    case "svg":
      return "image/svg+xml";
    case "png":
      return "image/png";
    case "ico":
      return "image/x-icon";
    default:
      // An unrecognized extension still links — browsers sniff the content, and
      // omitting the hint is better than asserting a type canopy guessed.
      return undefined;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Display title for a page — the string that leaves the site in the browser tab,
 * the bookmark, the search result, and the link preview.
 *
 * The whole answer lives in `pageName`, shared with both navigation paths, so
 * the tab and the sidebar cannot call one page two things.
 */
export function pageTitle(page: RenderedPage): string {
  return pageName(page.sitePath, declaredTitle(page.frontmatter, page.html));
}

/**
 * Tree depth as a class per item, the same pattern renderOutline uses for
 * headings — so a consumer can style deeper levels without re-deriving depth
 * from <ul> nesting.
 */
function renderNavList(nodes: NavNode[], from: string, depth = 0): string {
  if (nodes.length === 0) {
    return "";
  }
  const items = nodes
    .map((node) => {
      const label = escapeHtml(node.label);
      let link: string;
      if (node.sitePath === undefined) {
        link = `<span>${label}</span>`;
      } else {
        // The standard way to mark the current item in a set of links (MDN:
        // aria-current), so a caller can style it with `[aria-current="page"]`
        // rather than canopy inventing a class name for the same thing.
        const current = node.sitePath === from ? ' aria-current="page"' : "";
        link = `<a href="${escapeHtml(relativeHref(from, node.sitePath))}"${current}>${label}</a>`;
      }
      return `<li class="canopy-nav-l${depth}">${link}${renderNavList(node.children, from, depth + 1)}</li>`;
    })
    .join("");
  return `<ul>${items}</ul>`;
}

/**
 * The page's own headings as a contents list.
 *
 * Plain anchors to ids the page already carries — no script, matching how the
 * rest of the shell works. Nesting mirrors heading depth so the list reads as
 * the structure it describes.
 */
function renderOutline(outline: OutlineItem[], label: string): string {
  if (!isOutlineUseful(outline)) {
    return "";
  }
  const top = Math.min(...outline.map((item) => item.level));
  const items = outline
    .map((item) => {
      const depth = item.level - top;
      return `<li class="canopy-outline-l${depth}"><a href="#${escapeHtml(item.id)}">${escapeHtml(item.text)}</a></li>`;
    })
    .join("");
  return `<nav class="canopy-outline" aria-label="${escapeHtml(label)}"><ul>${items}</ul></nav>`;
}

function renderBacklinks(backlinks: Backlink[], from: string, heading: string): string {
  if (backlinks.length === 0) {
    return "";
  }
  const items = backlinks
    .map((link) => {
      // Named by the same ladder as everywhere else, so a page reached through
      // a backlink is not called something the sidebar never called it.
      const label = escapeHtml(pageName(link.sitePath, link.title));
      const href = escapeHtml(relativeHref(from, link.sitePath));
      return `<li><a href="${href}">${label}</a></li>`;
    })
    .join("");
  return `<section class="canopy-backlinks"><h2>${escapeHtml(heading)}</h2><ul>${items}</ul></section>`;
}

/**
 * Prev/next cards for the page's place in the sidebar's own reading order —
 * a projection of the same tree renderNavList already walks, not a second
 * source of truth. Labels are the neighboring NavNode's own label, never
 * invented text, for the same reason a folder's index page names itself: the
 * one name a reader already sees in the sidebar is the one this repeats.
 *
 * Omitted entirely for a page the navigation tree does not place (unplaced
 * pages have no defined neighbor) and for a tree with only one page (neither
 * neighbor exists) — there is nothing to link to either way.
 */
function renderPageNav(navigation: NavNode[], from: string, label: string): string {
  const flat = flattenNav(navigation);
  const at = flat.findIndex((entry) => entry.sitePath === from);
  if (at === -1) return "";
  const prev = flat[at - 1];
  const next = flat[at + 1];
  if (prev === undefined && next === undefined) return "";
  const prevLink = prev
    ? `<a class="canopy-prev" rel="prev" href="${escapeHtml(relativeHref(from, prev.sitePath))}">${escapeHtml(prev.label)}</a>`
    : "";
  const nextLink = next
    ? `<a class="canopy-next" rel="next" href="${escapeHtml(relativeHref(from, next.sitePath))}">${escapeHtml(next.label)}</a>`
    : "";
  return `<nav class="canopy-page-nav" aria-label="${escapeHtml(label)}">${prevLink}${nextLink}</nav>`;
}

/**
 * Wrap a rendered page's HTML body into a complete, self-contained HTML
 * document: head with metadata and stylesheets, a navigation sidebar, the
 * content, and a backlinks section. All internal links are relative to this
 * page so the site works when served from any sub-path.
 */
export function renderPage(
  page: RenderedPage,
  navigation: NavNode[],
  options: ShellOptions = {},
): string {
  const lang = options.lang ?? "en";
  const strings = { ...DEFAULT_STRINGS, ...options.strings };
  const stylesheets = options.stylesheets ?? ["tokens.css", "styles.css"];
  const title = pageTitle(page);
  const docTitle = options.siteTitle
    ? `${title} · ${options.siteTitle}`
    : title;

  const links = stylesheets
    .map(
      (sheet) =>
        `<link rel="stylesheet" href="${escapeHtml(relativeHref(page.sitePath, sheet))}">`,
    )
    .join("");

  const description = options.description
    ? `<meta name="description" content="${escapeHtml(options.description)}">`
    : "";

  const script = options.scriptPath
    ? `<script defer src="${escapeHtml(relativeHref(page.sitePath, options.scriptPath))}"></script>`
    : "";

  let icon = "";
  if (options.iconPath) {
    const type = iconType(options.iconPath);
    const href = escapeHtml(relativeHref(page.sitePath, options.iconPath));
    icon = `<link rel="icon"${type ? ` type="${type}"` : ""} href="${href}">`;
  }

  const logo =
    options.logoPath === undefined
      ? ""
      : `<img class="canopy-logo" src="${escapeHtml(relativeHref(page.sitePath, options.logoPath))}" alt="">`;
  const siteTitleLink = options.siteTitle
    ? `<a href="${escapeHtml(relativeHref(page.sitePath, "index.html"))}">${logo}${escapeHtml(options.siteTitle)}</a>`
    : logo;
  // A scheme, protocol-relative, root-absolute, or fragment URL is left
  // exactly as given — the same set `isExternalUrl` already carves out
  // elsewhere, and for the same reason: a root-absolute href already means
  // "the domain root" at any page depth, so adjusting it would break it.
  // Anything else names a path from the site's own root — as `home.url:
  // "../"` does for a product the site sits one level beneath — so it needs
  // the same depth prefix every other internal link here gets from
  // `relativeHref`, or it is only ever right at the site root.
  const homeHref =
    options.homeUrl === undefined
      ? undefined
      : isExternalUrl(options.homeUrl)
        ? options.homeUrl
        : relativeHref(page.sitePath, "") + options.homeUrl;
  const homeLink =
    homeHref !== undefined && options.homeLabel !== undefined
      ? `<a class="canopy-home" href="${escapeHtml(homeHref)}">${escapeHtml(options.homeLabel)}</a>`
      : "";
  const search = options.search
    ? `<form class="canopy-search" role="search" hidden><input type="search" name="q" aria-label="${escapeHtml(strings.search)}"></form>`
    : "";
  // No option gates this, unlike search: a caller-supplied script can flip a
  // reader's color scheme regardless of what else the site configures, the
  // same way the tokens it flips between (light/dark) need no field either.
  // It only rides along when a topbar exists for another reason, though —
  // manufacturing one just to hold a hidden button would cost every reader of
  // an otherwise chrome-free site a visible padded bar (see .canopy-topbar).
  const themeToggle = `<button type="button" class="canopy-theme-toggle" hidden aria-label="${escapeHtml(strings.toggleTheme)}"></button>`;
  const topbar =
    siteTitleLink === "" && homeLink === "" && search === ""
      ? ""
      : `<header class="canopy-topbar">${siteTitleLink}${homeLink}${search}${themeToggle}</header>`;

  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="canopy">
<title>${escapeHtml(docTitle)}</title>
${description}${icon}${links}${script}
</head>
<body>
${topbar}
<div class="canopy-layout">
<aside class="canopy-sidebar"><details class="canopy-nav" open><summary aria-label="${escapeHtml(strings.siteNav)}"></summary><nav>${renderNavList(navigation, page.sitePath)}</nav></details></aside>
<main class="canopy-main">
${renderOutline(page.outline, strings.onThisPage)}
<article class="canopy-content">${page.html}</article>
${renderBacklinks(page.backlinks, page.sitePath, strings.backlinks)}
${renderPageNav(navigation, page.sitePath, strings.pageNav)}
</main>
</div>
</body>
</html>
`;
}

/**
 * Render the synthetic root contents page: the navigation tree as a landing
 * page, wrapped in the same shell as every other page. Emitted by `emitSite`
 * when a site has no root index page of its own, so the site root (and the
 * sidebar site-title link, which always targets `index.html`) resolves.
 */
export function renderContentsPage(
  navigation: NavNode[],
  options: ShellOptions = {},
): string {
  const title = options.strings?.indexTitle ?? DEFAULT_STRINGS.indexTitle;
  const page: RenderedPage = {
    sourcePath: "",
    sitePath: "index.html",
    frontmatter: { title },
    html: `<h1>${escapeHtml(title)}</h1><div class="canopy-contents">${renderNavList(navigation, "index.html")}</div>`,
    backlinks: [],
    // The contents page *is* a navigation list; an outline of it would repeat itself.
    outline: [],
  };
  return renderPage(page, navigation, options);
}
