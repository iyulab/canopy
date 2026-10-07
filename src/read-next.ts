import type { PageProblem, RenderedPage } from "./contract.js";
import { type Layout, resolvePageLayout, streamFeatured } from "./layout.js";
import type { LinkIndex } from "./links.js";
import { resolveMarkdownLink } from "./markdown-link.js";
import { newestFirst, pageDate } from "./page-date.js";
import { pageTags, streamPosts, tagSlug, type TaggedPage } from "./tags.js";
import { parseWikiTarget } from "./wikilink.js";

/**
 * What to read after a page: the pages its author named, then — on a stream's
 * post — the stream's featured posts, the posts most like it, and the stream's
 * newest.
 *
 * The author's choice comes first and is never cut short: a page's `readNext:`
 * (a path, written like a markdown link from the page, or a `"[[wikilink]]"`;
 * one, or a list, in order) is shown whole, on any page of any profile. A
 * stream's post then fills what is left of its slots: the posts its stream
 * features (the rule's `featured`, the site's own choice), then posts sharing its tags —
 * a tag few posts carry counting for more than one most do — or linking to it
 * or from it, then the stream's newest posts.
 */

/** How many entries a stream post's list holds once filled. */
export const READ_NEXT_SLOTS = 3;

/** A page's `readNext:` as written — a list, or one string — trimmed, empty ones dropped. */
export function readNextValues(frontmatter: Readonly<Record<string, unknown>>): string[] {
  const raw = frontmatter.readNext;
  const values = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  return values.filter((value): value is string => typeof value === "string" && value.trim() !== "").map((value) => value.trim());
}

/**
 * The page one `readNext:` value names, in the build's spelling — or undefined
 * when it names no page of this site. A `"[[wikilink]]"` resolves as one does
 * in the text; anything else as a markdown link written on the page `from`.
 */
export function resolveReadNext(from: string, value: string, index: LinkIndex): string | undefined {
  const wiki = /^\[\[(.*)\]\]$/.exec(value.trim());
  if (wiki !== null) {
    const { target } = parseWikiTarget(wiki[1] ?? "");
    return target === "" ? undefined : index.resolve(target);
  }
  // A markdown link to a file that is not a page keeps its path; only a page is something to read next.
  const sitePath = resolveMarkdownLink(from, value, (candidate) => index.page(candidate));
  return sitePath === undefined ? undefined : index.page(sitePath);
}

/** Every `readNext:` value that names no page of this site, by the page that wrote it. */
export function readNextProblems(pages: readonly TaggedPage[], index: LinkIndex): PageProblem[] {
  const problems: PageProblem[] = [];
  for (const page of pages) {
    for (const value of readNextValues(page.frontmatter)) {
      if (resolveReadNext(page.sitePath, value, index) === undefined) {
        problems.push({ sitePath: page.sitePath, message: `readNext "${value}" names no page of this site` });
      }
    }
  }
  return problems;
}

/** The pages to read after `page`, and whether any of them was chosen rather than found. */
export interface ReadNext {
  sitePaths: string[];
  /** True when the author named at least one of them. */
  chosen: boolean;
}

export function pickReadNext(
  page: RenderedPage,
  pages: readonly RenderedPage[],
  layout: Layout | undefined,
  index: LinkIndex,
): ReadNext {
  const seen = new Set([page.sitePath.toLowerCase()]);
  const sitePaths: string[] = [];
  const add = (sitePath: string | undefined): void => {
    if (sitePath === undefined || seen.has(sitePath.toLowerCase())) return;
    seen.add(sitePath.toLowerCase());
    sitePaths.push(sitePath);
  };
  for (const value of readNextValues(page.frontmatter)) add(resolveReadNext(page.sitePath, value, index));

  // Only a stream's post is filled in: a manual page's list is what its author wrote.
  const dir = resolvePageLayout(layout, page.sitePath).streamDir;
  const posts = streamPosts(layout, pages).find((stream) => stream.dir.toLowerCase() === dir?.toLowerCase())?.posts;
  if (dir === undefined || posts === undefined || !posts.some((post) => post.sitePath === page.sitePath)) {
    return { sitePaths, chosen: sitePaths.length > 0 };
  }
  for (const sitePath of streamFeatured(layout, dir)) {
    if (sitePaths.length >= READ_NEXT_SLOTS) break;
    add(index.page(sitePath));
  }
  const chosen = sitePaths.length > 0;
  for (const sitePath of relatedPosts(page, posts)) {
    if (sitePaths.length >= READ_NEXT_SLOTS) break;
    add(sitePath);
  }
  for (const post of [...posts].sort(newestFirst)) {
    if (sitePaths.length >= READ_NEXT_SLOTS) break;
    add(post.sitePath);
  }
  return { sitePaths, chosen };
}

/**
 * A stream's posts like `page`, most alike first: each tag they share adds
 * `ln(N / df)` — N the stream's posts, df those carrying the tag, so a tag on
 * every post adds nothing — and a link either way adds 1. Only posts that score
 * above zero; a tie goes to the post published nearer, then to its path.
 */
export function relatedPosts(page: RenderedPage, posts: readonly RenderedPage[]): string[] {
  const slugs = (post: TaggedPage) => new Set(pageTags(post.frontmatter).map(tagSlug));
  const df = new Map<string, number>();
  for (const post of posts) for (const slug of slugs(post)) df.set(slug, (df.get(slug) ?? 0) + 1);
  const mine = slugs(page);
  const when = (post: TaggedPage) => {
    const date = pageDate(post);
    return date === undefined ? Number.NaN : Date.parse(date.slice(0, 10));
  };
  const at = when(page);
  const scored = posts
    .filter((post) => post.sitePath !== page.sitePath)
    .map((post) => {
      let score = 0;
      for (const slug of slugs(post)) {
        if (mine.has(slug)) score += Math.log(posts.length / (df.get(slug) ?? 1));
      }
      const linked =
        page.backlinks.some((link) => link.sitePath === post.sitePath) ||
        post.backlinks.some((link) => link.sitePath === page.sitePath);
      if (linked) score += 1;
      const distance = Math.abs(when(post) - at);
      return { sitePath: post.sitePath, score, distance: Number.isNaN(distance) ? Number.POSITIVE_INFINITY : distance };
    })
    .filter((entry) => entry.score > 0);
  scored.sort((a, b) => b.score - a.score || a.distance - b.distance || a.sitePath.localeCompare(b.sitePath));
  return scored.map((entry) => entry.sitePath);
}
