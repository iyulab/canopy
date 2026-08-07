import type { RenderedPage, Backlink } from "./contract.js";
import type { NavNode } from "./navigation.js";
import { relativeHref } from "./site-path.js";
import { isOutlineUseful, type OutlineItem } from "./outline.js";
import { declaredTitle, pageName } from "./title.js";

/** Options controlling the site shell wrapped around each page. */
export interface ShellOptions {
  /** Site name, shown in the sidebar header and document title. */
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
}

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

function renderNavList(nodes: NavNode[], from: string): string {
  if (nodes.length === 0) {
    return "";
  }
  const items = nodes
    .map((node) => {
      const label = escapeHtml(node.label);
      const link =
        node.sitePath !== undefined
          ? `<a href="${escapeHtml(relativeHref(from, node.sitePath))}">${label}</a>`
          : `<span>${label}</span>`;
      return `<li>${link}${renderNavList(node.children, from)}</li>`;
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
function renderOutline(outline: OutlineItem[]): string {
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
  return `<nav class="canopy-outline" aria-label="On this page"><ul>${items}</ul></nav>`;
}

function renderBacklinks(backlinks: Backlink[], from: string): string {
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
  return `<section class="canopy-backlinks"><h2>Linked references</h2><ul>${items}</ul></section>`;
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
  const homeLink =
    options.homeUrl !== undefined && options.homeLabel !== undefined
      ? `<a class="canopy-home" href="${escapeHtml(options.homeUrl)}">${escapeHtml(options.homeLabel)}</a>`
      : "";
  const sidebarHeader =
    siteTitleLink === "" && homeLink === ""
      ? ""
      : `<div class="canopy-site-title">${siteTitleLink}${homeLink}</div>`;

  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="canopy">
<title>${escapeHtml(docTitle)}</title>
${description}${icon}${links}
</head>
<body>
<div class="canopy-layout">
<aside class="canopy-sidebar">${sidebarHeader}<nav>${renderNavList(navigation, page.sitePath)}</nav></aside>
<main class="canopy-main">
${renderOutline(page.outline)}
<article class="canopy-content">${page.html}</article>
${renderBacklinks(page.backlinks, page.sitePath)}
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
  const page: RenderedPage = {
    sourcePath: "",
    sitePath: "index.html",
    frontmatter: { title: "Contents" },
    html: `<h1>Contents</h1><div class="canopy-contents">${renderNavList(navigation, "index.html")}</div>`,
    backlinks: [],
    // The contents page *is* a navigation list; an outline of it would repeat itself.
    outline: [],
  };
  return renderPage(page, navigation, options);
}
