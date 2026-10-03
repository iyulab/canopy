import type { SiteBundle, OutputFile } from "./contract.js";
import { feedPath, feedTitle, normalizeFeedDir, renderFeed } from "./feed.js";
import { buildSearchIndex } from "./search-index.js";
import { renderContentsPage, renderPage, type ShellOptions } from "./shell.js";
import { BASE_CSS } from "./styles.js";
import { callerStylesheetPath, inCanopyLayer } from "./stylesheets.js";
import { CANOPY_TOKENS } from "./tokens.js";

/** Options for emitting a site bundle to files. */
export interface EmitOptions extends ShellOptions {
  /**
   * Caller stylesheets' contents, in link order. Each is written to
   * `assets/stylesheet-<n>.css` (see `callerStylesheetPath`) exactly as given
   * and linked after canopy's own stylesheets. Canopy's CSS sits in the
   * `canopy` cascade layer, so these — unlayered unless they declare a layer
   * themselves — win over it at any specificity: a token restated, a region
   * hidden, a layout rewritten. The vocabulary they can rely on is
   * `THEME_HOOKS` and docs/THEMING.md.
   */
  styles?: string[];
  /**
   * Site paths of stylesheets the site itself publishes, linked last — after
   * canopy's own and after `styles`. Only linked: the file is published by
   * whatever copies the site's assets, at its own path, so a relative url()
   * inside it resolves as its author wrote it (which a carried `styles`
   * entry, moved to `assets/`, cannot promise).
   */
  siteStylesheets?: string[];
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
   * carries what a caller gives it, the same way `styles` carries CSS.
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
  const callerStyles = (options.styles ?? []).map((contents, index) => ({
    path: callerStylesheetPath(index),
    contents,
  }));
  const stylesheets = [
    ...(options.stylesheets ?? ["tokens.css", "styles.css"]),
    ...callerStyles.map((sheet) => sheet.path),
    ...(options.siteStylesheets ?? []),
  ];

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

  // Layered at the point canopy writes its own files, not in the exported
  // constants: a caller embedding CANOPY_TOKENS or BASE_CSS in a page of its
  // own keeps the cascade it already has. On a site canopy emits, the layer
  // is what lets every caller stylesheet win (see stylesheets.ts).
  files.push({ path: "tokens.css", contents: inCanopyLayer(CANOPY_TOKENS) });
  files.push({ path: "styles.css", contents: inCanopyLayer(BASE_CSS) });
  files.push(...callerStyles);

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
