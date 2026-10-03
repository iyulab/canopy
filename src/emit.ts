import type { SiteBundle, OutputFile } from "./contract.js";
import { feedPath, feedTitle, normalizeFeedDir, renderFeed } from "./feed.js";
import { buildSearchIndex } from "./search-index.js";
import { renderContentsPage, renderPage, type ShellOptions } from "./shell.js";
import { BASE_CSS } from "./styles.js";
import { CANOPY_TOKENS } from "./tokens.js";

/** Options for emitting a site bundle to files. */
export interface EmitOptions extends ShellOptions {
  /**
   * Design-token overrides, appended after canopy's own tokens in `tokens.css`.
   *
   * A caller states only what it wants to change; everything else keeps canopy's
   * value. Because the defaults end with a `prefers-color-scheme: dark` block and
   * a media query adds no specificity, a bare `:root` here applies to both
   * schemes — scheme-specific values need their own media query.
   */
  tokens?: string;
  /**
   * Output-relative path to write the search index JSON to. Opt-in: a
   * consumer with no search UI (or one that builds its own index some other
   * way) pays nothing for a file it will never read.
   */
  searchIndexPath?: string;
  /**
   * A caller-supplied script's file contents, carried unread and unmodified
   * into `assets/script.js` and linked `<script defer>` from every page.
   * Canopy authors no JavaScript itself (see docs/SCOPE.md); this only
   * carries what a caller gives it, the same way `tokens` carries CSS.
   */
  script?: string;
  /**
   * Folders (vault-relative, "" for the whole site) to publish an Atom feed
   * for, at `<dir>/feed.xml`, listing the dated pages beneath each one. Needs
   * `siteUrl`: a feed's ids and links are absolute. A folder with no dated page
   * gets no feed — and no link to one — rather than an empty feed with an
   * invented update time.
   */
  feeds?: string[];
}

/**
 * Turn a semantic site bundle into the set of text files to write to disk:
 * one complete HTML document per page, plus the shared token and layout
 * stylesheets. Tokens load before layout so layout reads the resolved values.
 *
 * Pure: no filesystem access. Binary assets (images, fonts) are copied by the
 * CLI/consumer, which owns IO; this core stays a deterministic transform.
 */
export function emitSite(
  bundle: SiteBundle,
  options: EmitOptions = {},
): OutputFile[] {
  const stylesheets = options.stylesheets ?? ["tokens.css", "styles.css"];

  const feeds: { dir: string; path: string; title: string; contents: string }[] = [];
  if (options.siteUrl !== undefined) {
    for (const dir of new Set((options.feeds ?? []).map(normalizeFeedDir))) {
      const contents = renderFeed(bundle.pages, bundle.navigation, dir, {
        siteUrl: options.siteUrl,
        ...(options.siteTitle === undefined ? {} : { siteTitle: options.siteTitle }),
        ...(options.lang === undefined ? {} : { lang: options.lang }),
      });
      if (contents === undefined) continue;
      feeds.push({
        dir,
        path: feedPath(dir),
        title: feedTitle(bundle.pages, bundle.navigation, dir, options.siteTitle),
        contents,
      });
    }
  }

  const shell: ShellOptions = {
    ...options,
    stylesheets,
    feedLinks: feeds.map(({ dir, path, title }) => ({ dir, path, title })),
    sitePages: bundle.pages,
    search: options.searchIndexPath !== undefined,
    scriptPath: options.script !== undefined ? "assets/script.js" : undefined,
  };

  const files: OutputFile[] = bundle.pages.map((page) => ({
    path: page.sitePath,
    contents: renderPage(page, bundle.navigation, shell),
  }));

  // A site with no root index page gets a synthetic contents landing page,
  // so the site root (and every page's site-title link) always resolves.
  if (!bundle.pages.some((page) => page.sitePath.toLowerCase() === "index.html")) {
    files.push({
      path: "index.html",
      contents: renderContentsPage(bundle.navigation, shell),
    });
  }

  // Layered, not replaced: `styles.css` reads ~60 custom properties, so a caller
  // that overrides one value must not lose the other 59. The caller's block comes
  // last, and the cascade does the rest.
  files.push({
    path: "tokens.css",
    contents:
      options.tokens === undefined
        ? CANOPY_TOKENS
        : `${CANOPY_TOKENS}\n/* --- caller tokens --- */\n${options.tokens}`,
  });
  files.push({ path: "styles.css", contents: BASE_CSS });

  if (options.searchIndexPath !== undefined) {
    files.push({
      path: options.searchIndexPath,
      contents: JSON.stringify(buildSearchIndex(bundle.pages)),
    });
  }
  if (options.script !== undefined) {
    files.push({ path: "assets/script.js", contents: options.script });
  }
  for (const feed of feeds) {
    files.push({ path: feed.path, contents: feed.contents });
  }
  return files;
}
