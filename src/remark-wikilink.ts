import type { Root, Link, Text } from "mdast";
import type { VFile } from "vfile";
import { findAndReplace } from "mdast-util-find-and-replace";
import GithubSlugger from "github-slugger";
import { parseWikiTarget } from "./wikilink.js";
import { relativeHref } from "./site-path.js";

/**
 * Per-build context the wikilink plugin reads from `vfile.data`.
 *
 * Passing the resolver through the file (rather than baking it into the
 * plugin) lets the unified processor stay frozen and shared across the whole
 * build while still resolving links against this build's index.
 */
export interface WikiContext {
  /** Resolve a wikilink target to a site path, or undefined when unresolved. */
  resolve(target: string): string | undefined;
  /** Site path of the document being rendered, for relative hrefs. */
  fromSitePath: string;
}

// `[[...]]`, capturing the inner text. mdast-util-find-and-replace skips code
// and inline code nodes, so wikilinks inside code are left untouched.
const WIKILINK = /\[\[([^[\]]+)\]\]/g;

/**
 * Rewrite `[[wikilinks]]` into relative hyperlinks and record this document's
 * outgoing links on `vfile.data.wikiLinks` (deduplicated) for backlink
 * computation. Unresolved targets degrade to plain text — deterministically,
 * never throwing.
 */
export default function remarkWikiLink() {
  return (tree: Root, file: VFile): void => {
    const ctx = file.data.wiki as WikiContext | undefined;
    if (ctx === undefined) {
      return;
    }
    const outgoing = new Set<string>();
    const slugger = new GithubSlugger();

    findAndReplace(tree, [
      [
        WIKILINK,
        (_match: string, inner: string): Link | Text => {
          const { target, heading, alias } = parseWikiTarget(inner);
          const resolved = target === "" ? ctx.fromSitePath : ctx.resolve(target);
          const display = alias ?? (target || (heading ? `#${heading}` : ""));

          if (resolved === undefined) {
            return { type: "text", value: display };
          }
          if (resolved !== ctx.fromSitePath) {
            outgoing.add(resolved);
          }

          slugger.reset();
          const fragment = heading ? `#${slugger.slug(heading)}` : "";
          const url = relativeHref(ctx.fromSitePath, resolved) + fragment;
          return {
            type: "link",
            url,
            children: [{ type: "text", value: display }],
          };
        },
      ],
    ]);

    file.data.wikiLinks = [...outgoing];
  };
}
