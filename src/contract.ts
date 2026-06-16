/**
 * Canopy's generic input/output contract.
 *
 * Canopy is app-agnostic: it knows ONLY "markdown + frontmatter + tree".
 * It must never reference any consuming app's internal types or hidden
 * config directory. Declaring the contract here — decoupled from any source
 * app — enforces that boundary structurally, not just by convention. If a
 * field that only makes sense for one consumer ever appears here, the
 * boundary has leaked.
 */

import type { NavNode } from "./navigation.js";

/** A single markdown source document in the tree. */
export interface SourceDocument {
  /**
   * POSIX-style path relative to the vault root, e.g. "notes/idea.md".
   * Canopy derives the site hierarchy from these paths alone — it does not
   * receive a pre-built tree, so no consumer's tree model leaks in.
   */
  path: string;
  /** Raw markdown, including any leading frontmatter block. */
  content: string;
}

/** The full input: a flat set of markdown documents. */
export interface SourceTree {
  documents: SourceDocument[];
}

/** A page that links to another page, recorded as a backlink. */
export interface Backlink {
  /** Site path of the page that links here. */
  sitePath: string;
  /** Title of the linking page, if it has one. */
  title: string | undefined;
}

/** A single rendered page in the output bundle. */
export interface RenderedPage {
  /** Path of the source document this page was rendered from. */
  sourcePath: string;
  /** Output path within the site bundle, e.g. "notes/idea.html". */
  sitePath: string;
  /** Parsed frontmatter metadata (title, etc.), empty when absent. */
  frontmatter: Record<string, unknown>;
  /** Rendered HTML body. */
  html: string;
  /** Pages that link to this one, sorted by site path. */
  backlinks: Backlink[];
}

/** The full output: a deployable static site bundle. */
export interface SiteBundle {
  pages: RenderedPage[];
  /** Navigation tree derived from the page paths. */
  navigation: NavNode[];
}

/** A single text file to write into the deployed site directory. */
export interface OutputFile {
  /** Path within the site, e.g. "notes/idea.html" or "styles.css". */
  path: string;
  /** UTF-8 text contents. */
  contents: string;
}
