import type { RenderedPage } from "./contract.js";
import { DEFAULT_PAGE_SIZE, folderRule, type Layout, resolvePageLayout, streamDirs } from "./layout.js";
import { pageDate } from "./page-date.js";

/**
 * Tags on a stream's posts, and the pages a build writes for them: one listing
 * every tag of the stream (`<dir>/tags/index.html`) and one per tag listing its
 * posts (`<dir>/tags/<slug>.html`) — continued, like the stream's own list, on
 * `<dir>/tags/<slug>/page/2.html` … once a tag has more posts than a page holds.
 *
 * Only a stream's pages are tagged. A manual page's `tags:` is left alone, so a
 * site that never asked for tag pages gets none from frontmatter it already had.
 */

/** What tagging reads of a page: where it comes from, where it goes, and its frontmatter. */
export type TaggedPage = Pick<RenderedPage, "sourcePath" | "sitePath" | "frontmatter">;

/** A tag of a stream, under the slug its page is named by. */
export interface StreamTag {
  slug: string;
  /** How the tag is shown: the spelling most of its posts use. */
  name: string;
  /** Its posts' site paths, newest first. */
  posts: string[];
}

/**
 * The slug a tag's page is named by: lowercase; a run of whitespace, and each
 * character that would break a path or a URL (`/ ? # % \` and control
 * characters), becomes `-`; dashes collapse and none are left at either end.
 * Letters of every script are kept as they are — a Korean tag has a Korean page.
 */
export function tagSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what this removes
    .replace(/[/?#%\\\u0000-\u001f\u007f]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * A page's tags as its frontmatter gives them — a list, or one string — trimmed,
 * empty ones dropped, and each slug once (the first spelling wins on the page).
 */
export function pageTags(frontmatter: Readonly<Record<string, unknown>>): string[] {
  const raw = frontmatter.tags;
  const values = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const value of values) {
    if (typeof value !== "string" || value.trim() === "") continue;
    const name = value.trim();
    const slug = tagSlug(name);
    if (seen.has(slug)) continue;
    seen.add(slug);
    tags.push(name);
  }
  return tags;
}

function newestFirst(a: TaggedPage, b: TaggedPage): number {
  const da = pageDate(a) ?? "";
  const db = pageDate(b) ?? "";
  return db.localeCompare(da) || a.sitePath.localeCompare(b.sitePath);
}

/**
 * The tags of one stream's posts, gathered by slug and sorted by it. Spellings
 * that share a slug are one tag, shown the way most of its posts spell it —
 * on a tie, the way the newest of them does. A tag with no usable slug, or one
 * whose page would be the list of all tags, is not here: it has no page
 * (`tagProblems` names it).
 */
export function streamTags(posts: readonly TaggedPage[]): StreamTag[] {
  type Gathered = { posts: string[]; spellings: Map<string, number>; order: string[] };
  const bySlug = new Map<string, Gathered>();
  for (const page of [...posts].sort(newestFirst)) {
    for (const name of pageTags(page.frontmatter)) {
      const slug = tagSlug(name);
      if (slug === "" || slug === "index") continue;
      const entry: Gathered = bySlug.get(slug) ?? { posts: [], spellings: new Map<string, number>(), order: [] };
      entry.posts.push(page.sitePath);
      if (!entry.spellings.has(name)) entry.order.push(name);
      entry.spellings.set(name, (entry.spellings.get(name) ?? 0) + 1);
      bySlug.set(slug, entry);
    }
  }
  return [...bySlug.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slug, entry]) => {
      // `order` is newest first, so on a tie the first counted wins.
      const name = entry.order.reduce((best, candidate) =>
        (entry.spellings.get(candidate) ?? 0) > (entry.spellings.get(best) ?? 0) ? candidate : best,
      );
      return { slug, name, posts: entry.posts };
    });
}

/** The page listing every tag of the stream in `dir`. */
export function tagIndexPath(dir: string): string {
  return dir === "" ? "tags/index.html" : `${dir}/tags/index.html`;
}

/**
 * A page of one tag's list in the stream in `dir`: the tag's own page for the
 * first, `<dir>/tags/<slug>/page/<n>.html` for each later one — the stream's
 * own `page/<n>` scheme, under the tag.
 */
export function tagPagePath(dir: string, slug: string, page = 1): string {
  const tags = dir === "" ? "tags" : `${dir}/tags`;
  return page <= 1 ? `${tags}/${slug}.html` : `${tags}/${slug}/page/${page}.html`;
}

/** How many pages one tag's list takes in the stream in `dir`: its posts, `pageSize` to a page. */
export function tagPageCount(layout: Layout | undefined, dir: string, tag: StreamTag): number {
  const size = folderRule(layout, dir)?.pageSize ?? DEFAULT_PAGE_SIZE;
  return Math.max(1, Math.ceil(tag.posts.length / size));
}

/** Each stream folder's posts — the pages its rule covers, its index aside — in the folder's own spelling. */
export function streamPosts(
  layout: Layout | undefined,
  pages: readonly TaggedPage[],
): { dir: string; posts: TaggedPage[] }[] {
  return streamDirs(layout).map((rule) => {
    const posts = pages.filter((page) => {
      const own = resolvePageLayout(layout, page.sitePath).streamDir;
      if (own === undefined || own.toLowerCase() !== rule.toLowerCase()) return false;
      const index = own === "" ? "index.html" : `${own}/index.html`;
      return page.sitePath.toLowerCase() !== index.toLowerCase() && page.sourcePath !== "";
    });
    const dir = rule === "" ? "" : (posts[0]?.sitePath.slice(0, rule.length) ?? rule);
    return { dir, posts };
  });
}

/**
 * The pages a build writes for the stream folders' tags: each tagged stream's
 * list of tags, then every page of each tag's list. Read from frontmatter
 * alone, so a caller that has not rendered anything names the same pages.
 */
export function streamTagPaths(layout: Layout | undefined, pages: readonly TaggedPage[]): string[] {
  return streamPosts(layout, pages).flatMap(({ dir, posts }) => {
    const tags = streamTags(posts);
    if (tags.length === 0) return [];
    return [
      tagIndexPath(dir),
      ...tags.flatMap((tag) =>
        Array.from({ length: tagPageCount(layout, dir, tag) }, (_, i) => tagPagePath(dir, tag.slug, i + 1)),
      ),
    ];
  });
}

/** Tags on a stream's posts that can have no page of their own, as messages naming the post. */
export function tagProblems(layout: Layout | undefined, pages: readonly TaggedPage[]): string[] {
  const problems: string[] = [];
  for (const { dir, posts } of streamPosts(layout, pages)) {
    for (const page of posts) {
      for (const name of pageTags(page.frontmatter)) {
        const slug = tagSlug(name);
        if (slug === "") problems.push(`${page.sitePath}: tag "${name}" has no letters or digits to name its page`);
        else if (slug === "index") {
          problems.push(
            `${page.sitePath}: tag "${name}" would be written at ${tagIndexPath(dir)}, the list of all tags`,
          );
        }
      }
    }
  }
  return problems;
}
