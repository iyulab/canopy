import type { RenderedPage, Backlink } from "./contract.js";
import type { NavNode } from "./navigation.js";
import { relativeHref } from "./site-path.js";

/** Options controlling the site shell wrapped around each page. */
export interface ShellOptions {
  /** Site name, shown in the sidebar header and document title. */
  siteTitle?: string;
  /** Document language for the <html lang> attribute. Defaults to "en". */
  lang?: string;
  /**
   * Stylesheet site paths to link in <head>, resolved relative to each page.
   * Defaults to ["tokens.css", "styles.css"]; consumers can append e.g. a
   * KaTeX stylesheet.
   */
  stylesheets?: string[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Stem of a site path (filename without extension), for fallback labels. */
function stemOf(sitePath: string): string {
  const file = sitePath.split("/").pop() ?? sitePath;
  return file.replace(/\.html$/i, "");
}

/** Display title for a page: frontmatter title, else its filename stem. */
export function pageTitle(page: RenderedPage): string {
  const title = page.frontmatter.title;
  return typeof title === "string" ? title : stemOf(page.sitePath);
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

function renderBacklinks(backlinks: Backlink[], from: string): string {
  if (backlinks.length === 0) {
    return "";
  }
  const items = backlinks
    .map((link) => {
      const label = escapeHtml(link.title ?? stemOf(link.sitePath));
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

  const sidebarHeader = options.siteTitle
    ? `<div class="canopy-site-title"><a href="${escapeHtml(relativeHref(page.sitePath, "index.html"))}">${escapeHtml(options.siteTitle)}</a></div>`
    : "";

  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="canopy">
<title>${escapeHtml(docTitle)}</title>
${links}
</head>
<body>
<div class="canopy-layout">
<aside class="canopy-sidebar">${sidebarHeader}<nav>${renderNavList(navigation, page.sitePath)}</nav></aside>
<main class="canopy-main">
<article class="canopy-content">${page.html}</article>
${renderBacklinks(page.backlinks, page.sitePath)}
</main>
</div>
</body>
</html>
`;
}
