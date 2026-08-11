import { visit } from "unist-util-visit";
import type { Element, Root } from "hast";

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

// A heading's own anchor, e.g. `## Some Title {#stable-id}` — matched only at
// the very end of the heading's last text child, so a heading that merely
// mentions "{#foo}" mid-sentence is left as prose. The required leading
// whitespace is the same boundary kramdown's and Pandoc's own header-
// attribute syntax use. `[\w:.-]+` covers ordinary slug shapes (letters,
// digits, hyphen, underscore) plus the punctuation HTML permits in an id
// (colon, dot) without accepting arbitrary characters that were clearly not
// meant as an id.
const TRAILING_ID_RE = /[ \t]+\{#([\w:.-]+)\}$/;

/**
 * Let a heading declare its own id instead of always taking whatever
 * github-slugger derives from its current wording — the renderer already
 * claims "headings have addressable ids" (rehype-slug), but offered no way
 * to pin one, so a heading's fragment silently changed on every wording
 * edit and broke every link into it.
 *
 * Runs after rehype-sanitize, for the same reason rehype-slug does: sanitize's
 * default schema prefixes any id it finds with "user-content-" to guard
 * against DOM clobbering, which would make an explicit id disagree with
 * every id rehype-slug derives (that plugin also runs after sanitize, so its
 * ids never pass through that prefixing either). Runs *before* rehype-slug,
 * which skips a heading that already carries `properties.id` — so an
 * explicit id always wins over the derived one, without rehype-slug needing
 * to know this plugin exists.
 *
 * Deliberately does not cross-check an explicit id against another heading's
 * derived slug, or register it with the GithubSlugger instance rehype-slug
 * and remark-wikilink's fragment resolution each own privately — there is no
 * shared instance to register it with, and a caller typing `[[note#heading]]`
 * still resolves the fragment by slugifying whatever text follows `#`, not by
 * reading the target page's actual ids. An id that is already a valid slug
 * shape (the common case: `which-one`, `order-detail`) round-trips through
 * that slugifying step unchanged, so linking to it as `[[note#which-one]]`
 * still works; an id containing characters slugifying would rewrite (a dot,
 * say) would not. Two headings declaring the same id, or one declaring an id
 * that collides with another heading's derived slug, is left as an authoring
 * mistake the same way a raw HTML `id=""` attribute always has been — not
 * something this renders incorrectly, but not something it validates either.
 */
export default function rehypeHeadingId() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (!HEADING_TAGS.has(node.tagName)) return;
      const last = node.children.at(-1);
      if (last === undefined || last.type !== "text") return;
      const match = TRAILING_ID_RE.exec(last.value);
      if (match === null) return;
      last.value = last.value.slice(0, match.index);
      if (last.value === "") node.children.pop();
      node.properties = { ...node.properties, id: match[1] };
    });
  };
}
