import { unified } from "unified";
import { VFile } from "vfile";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeKatex from "rehype-katex";
import rehypeShiki from "@shikijs/rehype";
import rehypeStringify from "rehype-stringify";
import { parseFrontmatter } from "./frontmatter.js";
import remarkWikiLink, { type WikiContext } from "./remark-wikilink.js";

/**
 * The markdown -> HTML pipeline:
 * - CommonMark (remark-parse) + GitHub extensions (remark-gfm) + math
 *   delimiters (remark-math), lowered to HTML.
 * - Raw embedded HTML is preserved (rehype-raw) but sanitized
 *   (rehype-sanitize) so safe authoring tags survive while scripts and other
 *   injection vectors are stripped.
 * - KaTeX (rehype-katex) and syntax highlighting (rehype-shiki) run *after*
 *   sanitize: their output is trusted (generated from parsed math/code, never
 *   from user raw HTML), so it is not stripped. The markers they consume
 *   (`math-inline`/`math-display` classes, `language-*` on code) pass through
 *   sanitize because the default schema is math- and language-aware.
 *
 * The processor is frozen and reused: it holds no per-document state, which
 * keeps the build stateless (same input -> same output). KaTeX needs its
 * stylesheet (katex CSS) bundled into the site shell to display correctly;
 * that lands with the asset pipeline (C26).
 */
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkWikiLink)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSanitize, defaultSchema)
  // rehype-slug runs *after* sanitize so heading ids are not clobbered with a
  // "user-content-" prefix; this keeps `[[note#heading]]` fragments matching.
  .use(rehypeSlug)
  .use(rehypeKatex)
  // Dual theme: emits both palettes as CSS variables (--shiki-dark*) so the
  // site stylesheet can switch code blocks with the page's color scheme.
  .use(rehypeShiki, { themes: { light: "github-light", dark: "github-dark" } })
  .use(rehypeStringify)
  .freeze();

/** Render a markdown body (no frontmatter, no wikilink resolution) to HTML. */
export async function renderMarkdown(markdown: string): Promise<string> {
  const file = await processor.process(markdown);
  return String(file);
}

/** A fully rendered document: frontmatter, HTML, and outgoing wikilinks. */
export interface RenderedDocument {
  frontmatter: Record<string, unknown>;
  html: string;
  /** Site paths this document links to (deduplicated), for backlinks. */
  outgoing: string[];
}

/**
 * Render a raw markdown document (frontmatter + body) into its metadata, HTML,
 * and outgoing wikilinks. Frontmatter is stripped before rendering, so it
 * never leaks into the published HTML. When a wiki context is supplied,
 * `[[wikilinks]]` are resolved to relative hyperlinks.
 */
export async function renderDocument(
  raw: string,
  wiki?: WikiContext,
): Promise<RenderedDocument> {
  const { data, body } = parseFrontmatter(raw);
  const file = new VFile({ value: body, data: wiki ? { wiki } : {} });
  await processor.process(file);
  const recorded = file.data.wikiLinks;
  const outgoing = Array.isArray(recorded) ? (recorded as string[]) : [];
  return { frontmatter: data, html: String(file), outgoing };
}
