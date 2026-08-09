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

import type { PluggableList } from "unified";
import type { NavNode } from "./navigation.js";
import type { NavSpec, AppliedNav } from "./nav-spec.js";
import type { OutlineItem } from "./outline.js";

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

/**
 * The full input: a flat set of markdown documents, and optionally the order to
 * present them in.
 *
 * `nav` stays optional and additive: without it the hierarchy still comes from
 * the document paths alone, so the generic contract is unchanged for callers
 * that have no order of their own to express.
 */
export interface SourceTree {
  documents: SourceDocument[];
  /**
   * Navigation order and labels. Canopy applies it and knows nothing about
   * where it came from — hand-written or generated are the same here.
   */
  nav?: NavSpec;
  /**
   * Rehype plugins extending canopy's own render pipeline, run at a fixed
   * position (see render.ts's `buildProcessor` for exactly where and why).
   * This is canopy's rendering surface, not a caller's domain — the plugins
   * a caller wants are unified plugin instances, generic to any hast tree,
   * the same shape canopy already uses for katex and Shiki internally.
   */
  rehypePlugins?: PluggableList;
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
  /**
   * The page's heading structure, in document order — the contents list a
   * reader uses to see what a long page holds. Derived from the rendered HTML,
   * so the ids match the anchors already in it.
   */
  outline: OutlineItem[];
}

/** The full output: a deployable static site bundle. */
export interface SiteBundle {
  pages: RenderedPage[];
  /** Navigation tree: from a supplied `nav` spec, else derived from the paths. */
  navigation: NavNode[];
  /**
   * How a supplied spec lined up with the build — which pages it left out, and
   * which of its paths matched nothing. Present only when a spec was given.
   *
   * Reported rather than acted on: whether an omitted page is an oversight or a
   * deliberate exclusion is the caller's judgment, not canopy's.
   */
  navReport?: AppliedNav;
}

/** A single text file to write into the deployed site directory. */
export interface OutputFile {
  /** Path within the site, e.g. "notes/idea.html" or "styles.css". */
  path: string;
  /** UTF-8 text contents. */
  contents: string;
}
