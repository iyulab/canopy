import { unified, type PluggableList } from "unified";
import { VFile } from "vfile";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkCjkFriendly from "remark-cjk-friendly/parseOnly";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeKatex from "rehype-katex";
import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import { createHighlighter } from "shiki";
import rehypeStringify from "rehype-stringify";
import { parseFrontmatter } from "./frontmatter.js";
import remarkMathSubset from "./remark-math-subset.js";
import remarkCallout from "./remark-callout.js";
import remarkWikiLink, { type WikiContext } from "./remark-wikilink.js";
import remarkMarkdownLink from "./remark-markdown-link.js";
import rehypeHeadingId from "./rehype-heading-id.js";

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
 *
 * A caller may extend the rehype stage with its own plugins
 * (`renderRehypePlugins`), fixed at exactly one position: after sanitize,
 * before Shiki. Not configurable, because both bounds are load-bearing:
 * - **After sanitize**: sanitize has no notion of a caller's plugin, so
 *   anything running before it is stripped down to the default schema —
 *   verified live with rehype-declart's actual SVG output, which came back
 *   as bare text when placed before sanitize and intact when placed after.
 *   The trust argument is the same one that already places rehype-katex and
 *   the Shiki plugin after sanitize (see above): output built from a fenced
 *   block's own parsed content, not from a user's raw HTML, is safe to emit
 *   unsanitized. A caller plugin sits at that same trust level or it
 *   shouldn't be here — canopy cannot verify which, so the position is the
 *   only enforcement available.
 * - **Before Shiki**: Shiki claims every fenced code block by its `language-*`
 *   class, including ones a caller's plugin means to replace — verified
 *   live: a `declart` fence rendered as a plain highlighted code block, and
 *   the caller's plugin never saw it, when Shiki ran first. A caller plugin
 *   that means to replace a fence's default code-block rendering has to run
 *   before Shiki claims it.
 */

// The callout transform (remark-callout) emits classed blockquotes/titles.
// Sanitize strips unknown classes, so allow exactly the callout set,
// element-scoped. The allowlist is origin-agnostic: authored raw HTML
// carrying these exact classes keeps them (styling-only, no script
// surface); every other class is stripped.
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    blockquote: [
      ...(defaultSchema.attributes?.blockquote ?? []),
      ["className", "callout", "callout-note", "callout-tip", "callout-warning", "callout-danger", "callout-quote"],
    ],
    p: [...(defaultSchema.attributes?.p ?? []), ["className", "callout-title"]],
  },
} as typeof defaultSchema;

const THEMES = { light: "github-light", dark: "github-dark" } as const;

/**
 * A highlighter that has tokenized once with every grammar it holds.
 *
 * The first tokenization with a newly loaded grammar comes out differently from
 * every one after it — measured on Shiki 4.2 and still present in 4.4: a
 * TypeScript `let` is unstyled the first time and a keyword every time after.
 * Two identical code blocks in one document therefore render differently, and
 * since a build is a fresh process, the first code block of a site is the one
 * that gets it wrong.
 *
 * That breaks the guarantee the whole build rests on — the same input always
 * yields the same output — so canopy absorbs it rather than passing it on. Each
 * grammar is tokenized once against a throwaway string as it is loaded, which
 * costs a few milliseconds and is work the first real render would have done
 * anyway. The string has to be non-empty: with nothing to tokenize, nothing
 * settles.
 *
 * This owns the highlighter rather than letting the plugin create one, because
 * the loading is where the warm-up has to happen and only its owner can see it.
 */
async function createWarmedHighlighter() {
  const highlighter = await createHighlighter({ themes: [...Object.values(THEMES)], langs: [] });
  const load = highlighter.loadLanguage.bind(highlighter);
  highlighter.loadLanguage = async (...langs) => {
    await load(...langs);
    for (const lang of langs) {
      if (typeof lang === "string") highlighter.codeToHast("x", { lang, themes: THEMES });
    }
  };
  return highlighter;
}

const buildProcessor = async (rehypePlugins: PluggableList) =>
  unified()
  .use(remarkParse)
  .use(remarkGfm)
  // CommonMark's emphasis rule treats `**` as closing only when the character
  // just outside it is whitespace/punctuation or the character just inside it
  // isn't — a rule written for scripts that use spaces between words. CJK text
  // has neither: a Korean particle or Japanese/Chinese punctuation sits flush
  // against the marker with no space, so `**label**를` never closes. Parsing
  // only (no `/bidi`): canopy never serializes back to markdown, so the
  // reverse mdast-util-to-markdown patch this package also offers is dead
  // weight here.
  .use(remarkCjkFriendly)
  .use(remarkMath)
  // Conservative math subset: currency-safe guards on single-$ spans and
  // standalone-line $$..$$ promotion to display math (see remark-math-subset).
  .use(remarkMathSubset)
  // Callout convention (`> [!type]`): top-level blockquotes become styled
  // callouts (see remark-callout). Runs before remark-rehype so the classes
  // ride through as hProperties.
  .use(remarkCallout)
  .use(remarkWikiLink)
  // Runs after remark-wikilink: that plugin turns `[[note]]` into mdast link
  // nodes whose urls are already site-relative, and this one only rewrites urls
  // it can resolve *inside the vault* — a resolved href like `../notes/idea.html`
  // is not a vault path, so wikilink output passes through untouched.
  .use(remarkMarkdownLink)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSanitize, sanitizeSchema)
  // Runs after sanitize for the same reason rehype-slug (next) does: sanitize's
  // default schema prefixes any id it finds with "user-content-" to guard
  // against DOM clobbering, which would make an explicit `{#id}` disagree with
  // every id rehype-slug derives. Runs *before* rehype-slug, which skips a
  // heading that already carries an id — so an explicit `{#id}` always wins.
  .use(rehypeHeadingId)
  // rehype-slug runs *after* sanitize so heading ids are not clobbered with a
  // "user-content-" prefix; this keeps `[[note#heading]]` fragments matching.
  .use(rehypeSlug)
  // A caller's rehype plugins (see the pipeline comment above for why exactly
  // here): trusted like katex/shiki because they run after sanitize, and
  // ahead of a caller-owned language tag because they run before Shiki.
  .use(rehypePlugins)
  .use(rehypeKatex)
  // Dual theme: emits both palettes as CSS variables (--shiki-dark*) so the
  // site stylesheet can switch code blocks with the page's color scheme.
  .use(rehypeShikiFromHighlighter, await createWarmedHighlighter(), {
    themes: THEMES,
    // Grammars load on demand rather than as one bundle. Shiki's default is to
    // load every language it ships before the first render, which costs seconds
    // that every caller pays on every build while a vault only ever uses a
    // handful of languages. Starting empty and loading per language makes the
    // cost proportional to the content: a grammar arrives in single-digit
    // milliseconds, and languages nobody writes are never loaded at all.
    lazy: true,
    // A fence with no language, and a fence naming one Shiki cannot resolve,
    // both render as plain "text" — themed and backgrounded like every other
    // code block, just with no syntax coloring — rather than as an unstyled
    // <pre> that looks like a different kind of element. A typo in a fence's
    // language is an authoring slip, not a build-breaking error, so
    // fallbackLanguage substitutes "text" for it before Shiki ever tries (and
    // fails) to load the name — no onError absorption needed for that case
    // anymore.
    defaultLanguage: "text",
    fallbackLanguage: "text",
  })
  .use(rehypeStringify)
  .freeze();

/**
 * Reused across calls that pass no rehype plugins of their own — the
 * overwhelmingly common case (every plain vault) — so a plain build still
 * pays the highlighter warm-up cost exactly once. Never mutated; `.use()`
 * on a `unified()` instance returns a new instance rather than changing this
 * one in place, so handing it out repeatedly is safe.
 */
const NO_REHYPE_PLUGINS: PluggableList = [];

/**
 * The pipeline, built once per distinct rehype plugin list and reused.
 *
 * A build passes the same plugin list (by reference) to every document it
 * renders — see `build()` in index.ts — so caching by reference equality
 * costs one rebuild per actual plugin set, not per document. It holds no
 * per-document state, which is what keeps the build stateless: the same
 * input yields the same output. Construction is asynchronous only because
 * the highlighter is, so it is done once and awaited by every caller.
 */
let pipeline: ReturnType<typeof buildProcessor> | undefined;
let pipelineFor: PluggableList | undefined;
function processor(rehypePlugins: PluggableList = NO_REHYPE_PLUGINS) {
  if (pipeline === undefined || pipelineFor !== rehypePlugins) {
    pipeline = buildProcessor(rehypePlugins);
    pipelineFor = rehypePlugins;
  }
  return pipeline;
}

/** Render a markdown body (no frontmatter, no wikilink resolution) to HTML. */
export async function renderMarkdown(
  markdown: string,
  rehypePlugins?: PluggableList,
): Promise<string> {
  const file = await (await processor(rehypePlugins)).process(markdown);
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
 *
 * `rehypePlugins` extends the rehype stage at a fixed position — see the
 * pipeline comment above `buildProcessor` for exactly where and why.
 */
export async function renderDocument(
  raw: string,
  wiki?: WikiContext,
  rehypePlugins?: PluggableList,
): Promise<RenderedDocument> {
  const { data, body } = parseFrontmatter(raw);
  const file = new VFile({ value: body, data: wiki ? { wiki } : {} });
  await (await processor(rehypePlugins)).process(file);
  const recorded = file.data.wikiLinks;
  const outgoing = Array.isArray(recorded) ? (recorded as string[]) : [];
  return { frontmatter: data, html: String(file), outgoing };
}
