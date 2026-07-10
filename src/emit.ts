import type { SiteBundle, OutputFile } from "./contract.js";
import { renderContentsPage, renderPage, type ShellOptions } from "./shell.js";
import { BASE_CSS } from "./styles.js";
import { CANOPY_TOKENS } from "./tokens.js";

/** Options for emitting a site bundle to files. */
export interface EmitOptions extends ShellOptions {
  /**
   * Design-token stylesheet to write as `tokens.css`. A consumer passes its
   * own tokens here (e.g. textree's `tokens.css`) so the published site
   * matches its app exactly; defaults to canopy's built-in tokens.
   */
  tokens?: string;
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
  const shell: ShellOptions = { ...options, stylesheets };

  const files: OutputFile[] = bundle.pages.map((page) => ({
    path: page.sitePath,
    contents: renderPage(page, bundle.navigation, shell),
  }));

  // A site with no root index page gets a synthetic contents landing page,
  // so the site root (and every page's site-title link) always resolves.
  if (!bundle.pages.some((page) => page.sitePath === "index.html")) {
    files.push({
      path: "index.html",
      contents: renderContentsPage(bundle.navigation, shell),
    });
  }

  files.push({ path: "tokens.css", contents: options.tokens ?? CANOPY_TOKENS });
  files.push({ path: "styles.css", contents: BASE_CSS });
  return files;
}
