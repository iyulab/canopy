import type { RenderedPage, Backlink } from "./contract.js";
import { type Layout, type PageLayout, type RegionName, resolvePageLayout, streamIndexPath } from "./layout.js";
import { isExternalUrl } from "./markdown-link.js";
import { ancestorPath, flattenNav, subtreeContains, type NavNode } from "./navigation.js";
import { htmlToText } from "./html-text.js";
import { fileUrl, pageUrl, relativeHref } from "./site-path.js";
import { isOutlineUseful, type OutlineItem } from "./outline.js";
import { formatPageDate, frontmatterDate, pageDate } from "./page-date.js";
import { declaredTitle, pageName } from "./title.js";
import { readingMinutes } from "./reading-time.js";
import { type ControlSlot, pageSlotText, renderFragment } from "./regions.js";

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
   * The site's one colour scheme, for a site that has only one. Every page is
   * drawn in it for every reader — `data-theme` on `<html>`, the attribute
   * canopy's stylesheet already reads — whatever the system preference, and
   * there is no theme toggle to place. Unset, a page follows the reader's
   * system preference and a script may switch it.
   */
  colorScheme?: "light" | "dark";
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
  /**
   * Site description for `<meta name="description">` and `og:description`,
   * used by link previews and search results. The fallback: a page whose
   * frontmatter carries its own `description` uses that instead, so two
   * pages of one site don't present the same summary to a search engine.
   */
  description?: string;
  /**
   * The absolute URL the site is published at. Every link canopy writes into
   * a page stays relative regardless — this feeds only the `<head>` tags that
   * are meaningless unless absolute: `rel="canonical"`, `og:url`, `og:image`,
   * and the `hreflang` alternates. Unset, none of those is written and the
   * output is exactly as portable as before (a site opened straight from a
   * local folder never needs them). Taken as given: the CLI checks its
   * `--site-url` for an `http(s)://` scheme, but a library caller passing
   * this directly is responsible for it being absolute — a bare path here
   * would be joined into "canonical" URLs that are nothing of the kind.
   */
  siteUrl?: string;
  /**
   * Site path of an image link previews show (`og:image`) when a page has no
   * `image` of its own in its frontmatter. Needs `siteUrl` to become the
   * absolute URL the tag requires; without one the tag is simply not written.
   */
  imagePath?: string;
  /**
   * Other language editions of this same site, as `hreflang` → that edition's
   * own absolute site URL (`x-default` is a valid key). Each page names its
   * counterpart at the same site path under each URL — canopy sees one tree
   * at a time and cannot check that the other edition really has that page,
   * so this is a declaration the editions keep true by mirroring each
   * other's structure. Needs `siteUrl`: a page has to name its own edition
   * in the same list, and that is the one URL this map doesn't carry.
   */
  alternates?: Record<string, string>;
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
   * Feeds to announce. A page inside a feed's folder (`dir`, "" for the whole
   * site) links it as `<link rel="alternate" type="application/atom+xml">`,
   * which is how a browser or a feed reader finds a feed from the page a
   * reader is on. Set by `emitSite` for each feed it actually writes.
   */
  feedLinks?: { dir: string; path: string; title: string }[];
  /**
   * Every page of the site, so a page asking for a listing (`listing: true` in
   * its frontmatter) can show each entry's date and summary, not only its
   * name. Set by `emitSite`; without it a listing shows names alone.
   */
  sitePages?: readonly RenderedPage[];
  /**
   * Which profile shapes each page and which fragments fill its regions (see
   * layout.ts). Without one every page is `manual` with no regions — the shell
   * exactly as canopy drew it before layouts existed.
   */
  layout?: Layout;
  /**
   * The contents of every fragment `layout` names, by vault path. Read by the
   * caller (the CLI reads them from the vault), so the shell stays free of IO
   * like the rest of the render core.
   */
  fragments?: Readonly<Record<string, string>>;
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
    /** Accessible label for the topbar's ancestor-trail nav (see `renderBreadcrumb`). */
    breadcrumb?: string;
    /** Accessible label for the other-language links a `language` slot shows. */
    language?: string;
    /** A stream page's reading time, with `{n}` where the minutes go. */
    readingTime?: string;
    /** The link that skips past the page's repeated header and navigation to its main content. */
    skipToContent?: string;
  };
}

/** The id of every page's `<main>`: the skip link's target, and a stable one a site's own link can use. */
export const MAIN_ID = "canopy-main";

const DEFAULT_STRINGS = {
  search: "Search",
  toggleTheme: "Toggle color theme",
  siteNav: "Site navigation",
  pageNav: "Page navigation",
  onThisPage: "On this page",
  indexTitle: "Contents",
  backlinks: "Linked references",
  breadcrumb: "Breadcrumb",
  language: "Languages",
  readingTime: "{n} min read",
  skipToContent: "Skip to content",
} as const;

type ShellStrings = Record<keyof typeof DEFAULT_STRINGS, string>;

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

export function escapeHtml(value: string): string {
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
 *
 * A node with children renders as its own `<details class="canopy-nav-group">`
 * — a different class from the outer `.canopy-nav` disclosure shell.ts already
 * wraps the whole tree in, so a group never picks up that one's mobile
 * full-screen-overlay styling. It opens exactly when `from` sits somewhere in
 * its own subtree (`subtreeContains`) — computed fresh on every page, so a
 * long nav tree shows the reader's own place in it already expanded and
 * everything unrelated collapsed, with no script and nothing to remember
 * across page loads. The node's own link (or label, for a folder with none)
 * sits inside <summary>: a click on it still navigates like any link (a
 * fresh page load replaces the disclosure entirely, so there's no stale
 * "toggled but didn't navigate" state to worry about); a click on the
 * chevron/padding around it toggles, the native <details> behavior with no
 * script needed for either.
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
      if (node.children.length === 0) {
        return `<li class="canopy-nav-l${depth}">${link}</li>`;
      }
      const open = subtreeContains(node, from) ? " open" : "";
      const childList = renderNavList(node.children, from, depth + 1);
      return `<li class="canopy-nav-l${depth}"><details class="canopy-nav-group"${open}><summary>${link}</summary>${childList}</details></li>`;
    })
    .join("");
  return `<ul>${items}</ul>`;
}

function outlineItems(outline: OutlineItem[]): string {
  const top = Math.min(...outline.map((item) => item.level));
  return outline
    .map((item) => {
      const depth = item.level - top;
      return `<li class="canopy-outline-l${depth}"><a href="#${escapeHtml(item.id)}">${escapeHtml(item.text)}</a></li>`;
    })
    .join("");
}

/**
 * A stream page's contents, before its body and open — a reader of one article
 * looks at what it covers before reading it, not beside it while reading. The
 * same `.canopy-outline` list as a manual page's, inside a disclosure a reader
 * can close, so anything that follows the outline (a scrollspy) works on both.
 */
function renderToc(outline: OutlineItem[], label: string): string {
  if (!isOutlineUseful(outline)) return "";
  return `<details class="canopy-toc" open><summary>${escapeHtml(label)}</summary><nav class="canopy-outline" aria-label="${escapeHtml(label)}"><ul>${outlineItems(outline)}</ul></nav></details>`;
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
  // aria-label stays alongside the visible <h2>, not replaced by it: a page
  // can carry more than one <nav> landmark (site nav, page nav, this one),
  // and the label is what tells them apart in a screen reader's landmark
  // list — the <h2> only adds a sighted reader's version of the same name,
  // matching renderBacklinks below, which already shows its own heading.
  return `<nav class="canopy-outline" aria-label="${escapeHtml(label)}"><h2>${escapeHtml(label)}</h2><ul>${outlineItems(outline)}</ul></nav>`;
}

/**
 * The trail from the site root to this page — "Guide / Orders / Payables" —
 * a projection of the same tree renderNavList already walks, not a second
 * source of truth (the same reasoning renderPageNav below already applies to
 * prev/next). Omitted for a page the tree does not place at all (the
 * synthetic contents page, most commonly) and for a page at the tree's own
 * top level: a one-entry trail says nothing a reader doesn't already read in
 * the page's own <h1>, the same reasoning isOutlineUseful already applies to
 * a single heading.
 */
function renderBreadcrumb(navigation: NavNode[], from: string, label: string): string {
  const chain = ancestorPath(navigation, from);
  if (chain.length < 2) {
    return "";
  }
  const items = chain
    .map((node) => {
      const text = escapeHtml(node.label);
      // The trail's own last crumb, and any ancestor folder with no index
      // page of its own, has nothing to link to — the same fallback
      // renderNavList already uses for the same case.
      if (node.sitePath === undefined || node.sitePath === from) {
        return `<li>${text}</li>`;
      }
      return `<li><a href="${escapeHtml(relativeHref(from, node.sitePath))}">${text}</a></li>`;
    })
    .join("");
  return `<nav class="canopy-breadcrumb" aria-label="${escapeHtml(label)}"><ol>${items}</ol></nav>`;
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
 * The `<head>` tags a search engine and a link preview read: the Open Graph
 * basics, a canonical URL, a preview image, and the page's other-language
 * editions.
 *
 * Split by what each tag needs. `og:title`/`og:description`/`og:site_name`/
 * `twitter:card` carry text a page already has, so they are always written.
 * `rel="canonical"`, `og:url`, `og:image` (for a site-relative image) and the
 * `hreflang` links are absolute URLs by definition, which canopy can only
 * form from `options.siteUrl` — absent that, they are left out entirely
 * rather than written relative, since a relative canonical is worse than
 * none. Body links stay relative either way: a site with these tags still
 * opens from a local folder, and only the tags themselves name where it is
 * published.
 */
function renderSocialMeta(
  page: RenderedPage,
  title: string,
  description: string | undefined,
  options: ShellOptions,
): string {
  const tags: string[] = [`<meta property="og:title" content="${escapeHtml(title)}">`];
  if (description !== undefined) {
    tags.push(`<meta property="og:description" content="${escapeHtml(description)}">`);
  }
  // The site's front page is the site; every other page is a document in it.
  const isFront = page.sitePath.toLowerCase() === "index.html";
  tags.push(`<meta property="og:type" content="${isFront ? "website" : "article"}">`);
  if (options.siteTitle !== undefined) {
    tags.push(`<meta property="og:site_name" content="${escapeHtml(options.siteTitle)}">`);
  }

  // A page's own frontmatter `image` wins over the site's default. An absolute
  // URL is used as given (the image may live on a CDN the site doesn't own);
  // a site path needs siteUrl to become one, like every other tag below.
  const ownImage = page.frontmatter.image;
  const imagePath =
    typeof ownImage === "string" && ownImage.trim() !== "" ? ownImage : options.imagePath;
  let imageUrl: string | undefined;
  if (imagePath !== undefined) {
    if (isExternalUrl(imagePath)) imageUrl = imagePath;
    else if (options.siteUrl !== undefined) imageUrl = fileUrl(options.siteUrl, imagePath);
  }
  if (imageUrl !== undefined) {
    tags.push(`<meta property="og:image" content="${escapeHtml(imageUrl)}">`);
  }
  // The card type follows whether there is actually an image to make it large.
  tags.push(
    `<meta name="twitter:card" content="${imageUrl === undefined ? "summary" : "summary_large_image"}">`,
  );

  // Open Graph's article vocabulary: when the page says it was published and
  // when it last changed. Both are the author's own statements — frontmatter,
  // or a file named by its day — and nothing else: canopy keeps no history, and
  // a date it inferred would be a guess presented as the author's claim.
  const published = pageDate(page);
  const modified = frontmatterDate(page.frontmatter.updated);
  if (published !== undefined) {
    tags.push(`<meta property="article:published_time" content="${escapeHtml(published)}">`);
  }
  // A modification time belongs to an article's publication record, so it is
  // written only beside the date it modifies — an undated page keeps exactly
  // the metadata it had before pages could be dated.
  if (published !== undefined && modified !== undefined) {
    tags.push(`<meta property="article:modified_time" content="${escapeHtml(modified)}">`);
  }

  let canonical: string | undefined;
  if (options.siteUrl !== undefined) {
    canonical = pageUrl(options.siteUrl, page.sitePath);
    tags.push(`<link rel="canonical" href="${escapeHtml(canonical)}">`);
    tags.push(`<meta property="og:url" content="${escapeHtml(canonical)}">`);

    if (options.alternates !== undefined) {
      // A page has to list its own edition among the alternates (the
      // protocol's rule: a set of alternates is only valid when every member
      // names every other, itself included), so the site's own language leads
      // the list unless the map already places it somewhere explicitly.
      const lang = options.lang ?? "en";
      const editions: [string, string][] = Object.hasOwn(options.alternates, lang)
        ? []
        : [[lang, options.siteUrl]];
      editions.push(...Object.entries(options.alternates));
      for (const [hreflang, siteUrl] of editions) {
        tags.push(
          `<link rel="alternate" hreflang="${escapeHtml(hreflang)}" href="${escapeHtml(pageUrl(siteUrl, page.sitePath))}">`,
        );
      }
    }
  }

  if (published !== undefined) {
    tags.push(
      renderArticleData({
        headline: title,
        description,
        published,
        modified,
        lang: options.lang ?? "en",
        author: page.frontmatter.author,
        imageUrl,
        canonical,
      }),
    );
  }
  return tags.join("");
}

/**
 * schema.org `Article` structured data for a dated page — how a search engine
 * tells an article (a headline, a publication date, an author) from an undated
 * reference page. Written only when the page is dated (`pageDate`): without one
 * there is no article to describe, and every other page keeps the metadata it
 * already had.
 *
 * A `<script type="application/ld+json">` is a data block, not a script: the
 * browser never executes it (see docs/SCOPE.md, "Author client-side code").
 * Its JSON escapes `<`, so no frontmatter string can close the element early.
 *
 * `image` and `url` are absolute or absent, the same rule as `og:image` and
 * `rel="canonical"`. `author` is the page's own `author:` string, as a person's
 * name — the one shape canopy can state without guessing whether a bare name
 * is a person or an organization's.
 */
function renderArticleData(article: {
  headline: string;
  description: string | undefined;
  published: string;
  modified: string | undefined;
  lang: string;
  author: unknown;
  imageUrl: string | undefined;
  canonical: string | undefined;
}): string {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.headline,
  };
  if (article.description !== undefined) data.description = article.description;
  data.datePublished = article.published;
  if (article.modified !== undefined) data.dateModified = article.modified;
  data.inLanguage = article.lang;
  if (typeof article.author === "string" && article.author.trim() !== "") {
    data.author = { "@type": "Person", name: article.author.trim() };
  }
  if (article.imageUrl !== undefined) data.image = article.imageUrl;
  if (article.canonical !== undefined) {
    data.url = article.canonical;
    data.mainEntityOfPage = article.canonical;
  }
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

/**
 * The pages a page fronts, as a listing at the end of its content — for a page
 * whose frontmatter says `listing: true`: a folder's index page, typically, over
 * a series of dated pages.
 *
 * A projection of the navigation tree, like the sidebar and prev/next: the
 * entries are this page's own children there (for the site's front page, the
 * rest of the top level), in the same order the sidebar shows them, and each is
 * named the same way. What a page says about itself comes along — its `date:`
 * and its own `description:` — so the index of a series stays current without
 * anyone restating, by hand, what every entry already states. A group with no
 * page of its own lists its pages beneath its label.
 */
function renderListing(
  page: RenderedPage,
  navigation: NavNode[],
  options: ShellOptions,
  lang: string,
  pageLayout: PageLayout,
  strings: ShellStrings,
): string {
  // A stream's index always lists the stream — that is what it is for; any
  // other page lists what it fronts only when it asks to.
  if (page.frontmatter.listing !== true && !isStreamIndex(page, pageLayout)) return "";
  const chain = ancestorPath(navigation, page.sitePath);
  const self = chain[chain.length - 1];
  let entries = self?.children ?? [];
  if (entries.length === 0 && page.sitePath.toLowerCase() === "index.html") {
    entries = navigation.filter((node) => node !== self);
  }
  if (entries.length === 0) return "";

  const bySitePath = new Map((options.sitePages ?? []).map((p) => [p.sitePath, p]));
  const items = (nodes: NavNode[]): string =>
    nodes
      .map((node) => {
        const label = escapeHtml(node.label);
        const name =
          node.sitePath === undefined
            ? `<span class="canopy-listing-title">${label}</span>`
            : `<a class="canopy-listing-title" href="${escapeHtml(relativeHref(page.sitePath, node.sitePath))}">${label}</a>`;
        const entry = node.sitePath === undefined ? undefined : bySitePath.get(node.sitePath);
        const published = entry === undefined ? undefined : pageDate(entry);
        const date =
          published === undefined
            ? ""
            : ` <time datetime="${escapeHtml(published)}">${escapeHtml(formatPageDate(published, lang))}</time>`;
        const own = entry?.frontmatter.description;
        const summary =
          typeof own === "string" && own.trim() !== "" ? `<p>${escapeHtml(own.trim())}</p>` : "";
        const nested = node.sitePath === undefined && node.children.length > 0 ? `<ul>${items(node.children)}</ul>` : "";
        // Only in a stream, where how long a post is helps choose one; a manual
        // listing stays exactly what it was.
        const minutes =
          pageLayout.profile === "stream" && entry !== undefined
            ? ` <span class="canopy-reading-time">${escapeHtml(readingTime(entry.html, lang, strings.readingTime))}</span>`
            : "";
        // A stream's cards carry their posts' covers; a manual listing stays as it was.
        const cover =
          pageLayout.profile === "stream" && entry !== undefined ? renderCover(entry, page.sitePath, true) : "";
        return `<li>${cover}${name}${date}${minutes}${summary}${nested}</li>`;
      })
      .join("");
  return `<ul class="canopy-listing">${items(entries)}</ul>`;
}

/** Insert `markup` right after the page's `<h1>`, or at the very top when it has none. */
function afterTitle(html: string, markup: string): string {
  if (markup === "") return html;
  const end = html.indexOf("</h1>");
  if (end === -1) return markup + html;
  const at = end + "</h1>".length;
  return html.slice(0, at) + markup + html.slice(at);
}

/**
 * The page's publication date where a reader looks for it: right under its
 * title, the `<h1>` that opens the content (or atop the content when the title
 * comes from frontmatter and the page has no heading of its own).
 *
 * Placed by the shell rather than written into the page body, so the date is
 * page chrome — the search index and every other reader of the body text never
 * see it as something the author wrote in the document.
 */
function withPageDate(page: RenderedPage, lang: string): string {
  const { html } = page;
  const published = pageDate(page);
  if (published === undefined) return html;
  return afterTitle(
    html,
    `<p class="canopy-date"><time datetime="${escapeHtml(published)}">${escapeHtml(formatPageDate(published, lang))}</time></p>`,
  );
}

function readingTime(html: string, lang: string, template: string): string {
  return template.replace("{n}", String(readingMinutes(htmlToText(html), lang)));
}

function isStreamIndex(page: RenderedPage, pageLayout: PageLayout): boolean {
  return (
    pageLayout.streamDir !== undefined &&
    page.sitePath.toLowerCase() === streamIndexPath(pageLayout.streamDir).toLowerCase()
  );
}

/**
 * A stream page's opening, after its title: the page's own summary as a lead,
 * then when it was published and how long it takes to read, then what it
 * covers. The index of a stream gets only its lead — its date and length are
 * not what a reader looks for there, and its list is its contents.
 */
function streamOpening(
  page: RenderedPage,
  pageLayout: PageLayout,
  lang: string,
  strings: ShellStrings,
): string {
  const own = page.frontmatter.description;
  const lead =
    typeof own === "string" && own.trim() !== "" ? `<p class="canopy-lead">${escapeHtml(own.trim())}</p>` : "";
  if (isStreamIndex(page, pageLayout)) return afterTitle(page.html, lead);
  const published = pageDate(page);
  const date =
    published === undefined
      ? ""
      : `<time class="canopy-date" datetime="${escapeHtml(published)}">${escapeHtml(formatPageDate(published, lang))}</time>`;
  const author = textField(page.frontmatter.author);
  const by = author === undefined ? "" : `<span class="canopy-author">${escapeHtml(author)}</span>`;
  const byline = `<p class="canopy-byline">${by}${date}<span class="canopy-reading-time">${escapeHtml(readingTime(page.html, lang, strings.readingTime))}</span></p>`;
  const cover = renderCover(page, page.sitePath, false);
  return afterTitle(page.html, `${lead}${byline}${cover}${renderToc(page.outline, strings.onThisPage)}`);
}

/** A frontmatter value that is a non-empty string, trimmed — or undefined. */
function textField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

/**
 * A page's cover — its frontmatter `image:`, the same picture link previews
 * show — as an image addressed from the page it appears on (`from`).
 *
 * A site path is relative to the site root, as for `og:image`, so it is
 * rewritten relative to `from`; an absolute or root-absolute URL is the
 * author's to choose and is used as written. The cover sits beside the title
 * that says what it shows, so it carries no text of its own (`alt=""`). In a
 * listing it is one of many below the fold: `lazy` lets the browser wait.
 */
function renderCover(page: RenderedPage, from: string, lazy: boolean): string {
  const image = textField(page.frontmatter.image);
  if (image === undefined) return "";
  const src = isExternalUrl(image) ? image : relativeHref(from, image.replace(/^\.\//, ""));
  return `<img class="canopy-cover" src="${escapeHtml(src)}" alt=""${lazy ? ' loading="lazy"' : ""}>`;
}

/**
 * Every control canopy draws, rendered for one page — the pieces its own top
 * bar is assembled from, and what a fragment's control slots are replaced by.
 * One renderer for both, so a control placed in a site's own header is the
 * same markup, with the same hooks, as the one in canopy's top bar.
 *
 * Each control is drawn the first time the page asks for it, and once: a page
 * whose header has no language slot never works out its other editions, and a
 * stream page, whose way back is its list, never walks the tree for a
 * breadcrumb.
 */
function renderControls(
  page: RenderedPage,
  navigation: NavNode[],
  options: ShellOptions,
  strings: ShellStrings,
  pageLayout: PageLayout,
): (name: ControlSlot) => string {
  const logo =
    options.logoPath === undefined
      ? ""
      : `<img class="canopy-logo" src="${escapeHtml(relativeHref(page.sitePath, options.logoPath))}" alt="">`;
  // Its own class rather than a position in the top bar: a site title placed
  // in a site's own header keeps its look there too (docs/THEMING.md).
  const siteTitle = options.siteTitle
    ? `<a class="canopy-site-title" href="${escapeHtml(relativeHref(page.sitePath, "index.html"))}">${logo}${escapeHtml(options.siteTitle)}</a>`
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
  // A reader reaching this link right after the breadcrumb (both sit in the
  // same spot in the topbar) has every reason to expect it stays inside the
  // site, the way the breadcrumb always does — canopy already knows when
  // that expectation is wrong, so it marks it rather than staying silent.
  //
  // Deliberately narrower than isExternalUrl above: that check answers "does
  // this href need depth-prefixing", and root-absolute ("/") and a bare
  // fragment both answer no to that while staying on this same site — a
  // root-absolute home.url addresses this site's own domain root, not
  // somewhere else. "Leaves the site" only actually holds for an explicit
  // scheme (https:, mailto:, ...) or a protocol-relative "//host" URL.
  const homeLeavesSite =
    options.homeUrl !== undefined &&
    (options.homeUrl.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(options.homeUrl));
  const homeLink =
    homeHref !== undefined && options.homeLabel !== undefined
      ? `<a class="canopy-home${homeLeavesSite ? " canopy-home-external" : ""}" href="${escapeHtml(homeHref)}">${escapeHtml(options.homeLabel)}</a>`
      : "";
  const search = options.search
    ? `<form class="canopy-search" role="search" hidden><input type="search" name="q" placeholder="${escapeHtml(strings.search)}" aria-label="${escapeHtml(strings.search)}"></form>`
    : "";
  // No option gates this, unlike search: a caller-supplied script can flip a
  // reader's color scheme regardless of what else the site configures, the
  // same way the tokens it flips between (light/dark) need no field either.
  // canopy's own top bar carries it only when that bar exists for another
  // reason — manufacturing one just to hold a hidden button would cost every
  // reader of an otherwise chrome-free site a visible padded bar (see
  // .canopy-topbar) — but a fragment can place it anywhere with a slot.
  // Nothing to toggle on a site with one scheme, so nothing a script could
  // wire up either — and no remembered choice from another site on the same
  // origin can switch it.
  const themeToggle =
    options.colorScheme !== undefined
      ? ""
      : `<button type="button" class="canopy-theme-toggle" hidden aria-label="${escapeHtml(strings.toggleTheme)}"></button>`;
  // Past every block repeated on each page — top bar or site header, sidebar
  // tree — to the page's own content (WCAG 2.4.1). The target is a fixed id,
  // part of the public contract, so a site's own link can point at it too.
  const skipLink = `<a class="canopy-skip-link" href="#${MAIN_ID}">${escapeHtml(strings.skipToContent)}</a>`;
  const draw: Record<ControlSlot, () => string> = {
    "site-title": () => siteTitle,
    home: () => homeLink,
    back: () => renderBack(page, options, pageLayout),
    breadcrumb: () => renderBreadcrumb(navigation, page.sitePath, strings.breadcrumb),
    language: () => renderLanguage(page, options, strings.language),
    search: () => search,
    "theme-toggle": () => themeToggle,
    "skip-link": () => skipLink,
  };
  const drawn = new Map<ControlSlot, string>();
  return (name) => {
    let markup = drawn.get(name);
    if (markup === undefined) {
      markup = draw[name]();
      drawn.set(name, markup);
    }
    return markup;
  };
}

/**
 * A stream page's way back to the list it belongs to — named as that index page
 * is named everywhere else. Nothing on the index itself, and nothing on a
 * manual page, whose way back is the breadcrumb.
 */
function renderBack(page: RenderedPage, options: ShellOptions, pageLayout: PageLayout): string {
  if (pageLayout.streamDir === undefined) return "";
  const target = streamIndexPath(pageLayout.streamDir).toLowerCase();
  if (page.sitePath.toLowerCase() === target) return "";
  const index = options.sitePages?.find((candidate) => candidate.sitePath.toLowerCase() === target);
  if (index === undefined) return "";
  return `<a class="canopy-back" href="${escapeHtml(relativeHref(page.sitePath, index.sitePath))}">${escapeHtml(pageTitle(index))}</a>`;
}

/**
 * A language's name in that language — "한국어", "English", "日本語" — the
 * label a reader of that edition recognizes whatever edition they are on. The
 * tag itself when the runtime has no name for it.
 */
export function languageName(tag: string): string {
  try {
    return new Intl.DisplayNames([tag], { type: "language" }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}

/**
 * This page in the site's other language editions — the same `alternates` and
 * the same derivation the `hreflang` links in `<head>` use (an edition's URL
 * plus this page's site path), so a reader and a crawler are sent to the same
 * place. `x-default` names no language and the site's own edition is where the
 * reader already is, so neither is offered.
 */
function renderLanguage(page: RenderedPage, options: ShellOptions, label: string): string {
  if (options.siteUrl === undefined || options.alternates === undefined) return "";
  const own = (options.lang ?? "en").toLowerCase();
  const siteUrl = options.siteUrl.replace(/\/+$/, "");
  const links = Object.entries(options.alternates)
    .filter(
      ([tag, url]) =>
        tag !== "x-default" && tag.toLowerCase() !== own && url.replace(/\/+$/, "") !== siteUrl,
    )
    .map(
      ([tag, url]) =>
        `<a href="${escapeHtml(pageUrl(url, page.sitePath))}" hreflang="${escapeHtml(tag)}" lang="${escapeHtml(tag)}">${escapeHtml(languageName(tag))}</a>`,
    )
    .join("");
  return links === "" ? "" : `<nav class="canopy-language" aria-label="${escapeHtml(label)}">${links}</nav>`;
}

/** One region of one page: its fragment rendered there, or `""` when the page has none. */
function renderRegion(
  name: RegionName,
  page: RenderedPage,
  options: ShellOptions,
  pageLayout: PageLayout,
  control: (slot: ControlSlot) => string,
): string {
  const file = pageLayout.regions[name];
  if (file === undefined) return "";
  const html = options.fragments?.[file];
  if (html === undefined) throw new Error(`region ${name}: fragment "${file}" was not supplied`);
  return renderFragment(html, {
    from: page.sitePath,
    control,
    page: (key) => pageSlotText(page.frontmatter, key),
  }).trim();
}

/** An article region in a box of its own, so a site can space or hide it as one thing. */
function wrapRegion(className: string, html: string): string {
  return html === "" ? "" : `<div class="${className}">${html}</div>`;
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
  const strings: ShellStrings = { ...DEFAULT_STRINGS, ...options.strings };
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

  // The page's own summary first, the site's as the fallback: one description
  // repeated on every page reads to a search engine as duplicate metadata,
  // and to a reader sharing a link as a preview that says nothing about the
  // page they chose. Only a non-empty string counts — frontmatter is untyped,
  // and a `description:` left blank shouldn't erase the site's own.
  const ownDescription = page.frontmatter.description;
  const description =
    typeof ownDescription === "string" && ownDescription.trim() !== ""
      ? ownDescription
      : options.description;
  const descriptionTag = description
    ? `<meta name="description" content="${escapeHtml(description)}">`
    : "";
  const social = renderSocialMeta(page, title, description, options);

  const feedTags = (options.feedLinks ?? [])
    .filter(
      (feed) =>
        feed.dir === "" || page.sitePath.toLowerCase().startsWith(`${feed.dir.toLowerCase()}/`),
    )
    .map(
      (feed) =>
        `<link rel="alternate" type="application/atom+xml" title="${escapeHtml(feed.title)}" href="${escapeHtml(relativeHref(page.sitePath, feed.path))}">`,
    )
    .join("");

  const script = options.scriptPath
    ? `<script defer src="${escapeHtml(relativeHref(page.sitePath, options.scriptPath))}"></script>`
    : "";

  let icon = "";
  if (options.iconPath) {
    const type = iconType(options.iconPath);
    const href = escapeHtml(relativeHref(page.sitePath, options.iconPath));
    icon = `<link rel="icon"${type ? ` type="${type}"` : ""} href="${href}">`;
  }

  const pageLayout = resolvePageLayout(options.layout, page.sitePath);
  const control = renderControls(page, navigation, options, strings, pageLayout);
  // The controls this page's fragments place, noted as they are rendered.
  const placed = new Set<ControlSlot>();
  const region = (name: RegionName): string =>
    renderRegion(name, page, options, pageLayout, (slot) => {
      placed.add(slot);
      return control(slot);
    });

  // Like the theme toggle, breadcrumb rides along only when the topbar
  // already exists for another reason — it never manufactures one by itself,
  // the same "a genuinely chrome-free site stays chrome-free" guarantee.
  //
  // Search and the theme toggle share one wrapper rather than sitting as two
  // separate flex children of .canopy-topbar: a narrow topbar can wrap either
  // of them onto a second line (see .canopy-topbar's own flex-wrap), and
  // without a shared box each wraps independently — search alone stays
  // right-aligned via its own margin, but the toggle right after it (sized to
  // fill whatever gap search left behind) can then land on a *third* line by
  // itself, flush left, reading as a stray icon rather than as this pair. One
  // wrapper wraps as one unit, so the two always land together and stay
  // right-aligned together, on whichever line they end up on.
  const stream = pageLayout.profile === "stream";
  // A stream page's way back is its list, not a trail through a tree it does
  // not show; the bar exists when it has that to hold, like anything else.
  const topbar = (): string => {
    const trail = control(stream ? "back" : "breadcrumb");
    return control("site-title") === "" && control("home") === "" && control("search") === "" && (!stream || trail === "")
      ? ""
      : `<header class="canopy-topbar">${control("site-title")}${trail}${control("home")}<div class="canopy-topbar-controls">${control("search")}${control("theme-toggle")}</div></header>`;
  };
  // A header fragment replaces the top bar outright — the site's own markup,
  // with canopy's controls only where its slots put them (see regions.ts).
  const header = pageLayout.regions.header === undefined ? topbar() : region("header");
  const before = wrapRegion("canopy-before-article", region("beforeArticle"));
  const after = wrapRegion("canopy-after-article", region("afterArticle"));
  const footer = region("footer");
  const head = region("head");
  // First in the body, so it is the first thing a keyboard reaches — unless a
  // fragment on this page placed it itself, inside the site's own markup.
  const skip = placed.has("skip-link") ? "" : `${control("skip-link")}\n`;
  // A stream shows no tree: the whole tree on every page of a long stream is
  // quadratic weight for navigation a reader of one post does not use.
  const sidebar = stream
    ? ""
    : `<aside class="canopy-sidebar"><details class="canopy-nav" open><summary aria-label="${escapeHtml(strings.siteNav)}"></summary><nav>${renderNavList(navigation, page.sitePath)}</nav></details></aside>\n`;
  const body = stream
    ? streamOpening(page, pageLayout, lang, strings)
    : withPageDate(page, lang);
  const around = stream
    ? ""
    : `${renderOutline(page.outline, strings.onThisPage)}\n${renderBacklinks(page.backlinks, page.sitePath, strings.backlinks)}\n${renderPageNav(navigation, page.sitePath, strings.pageNav)}\n`;

  // A fixed scheme also tells the browser, so its own controls and scrollbars match.
  const schemeAttr = options.colorScheme === undefined ? "" : ` data-theme="${options.colorScheme}"`;
  const schemeMeta =
    options.colorScheme === undefined ? "" : `<meta name="color-scheme" content="${options.colorScheme}">\n`;

  return `<!doctype html>
<html lang="${escapeHtml(lang)}" data-canopy-profile="${pageLayout.profile}"${schemeAttr}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="canopy">
${schemeMeta}<title>${escapeHtml(docTitle)}</title>
${descriptionTag}${social}${feedTags}${icon}${links}${script}${head}
</head>
<body>
${skip}${header}
<div class="canopy-layout">
${sidebar}<main class="canopy-main" id="${MAIN_ID}">
<article class="canopy-content">${before}${body}${renderListing(page, navigation, options, lang, pageLayout, strings)}${after}</article>
${around}</main>
</div>
${footer === "" ? "" : `${footer}\n`}</body>
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
