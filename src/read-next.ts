import type { PageProblem, RenderedPage } from "./contract.js";
import { type Layout, resolvePageLayout, streamFeatured } from "./layout.js";
import type { LinkIndex } from "./links.js";
import { resolveMarkdownLink } from "./markdown-link.js";
import { newestFirst, pageDate } from "./page-date.js";
import { pageTagSlugs, streamPosts, type TaggedPage } from "./tags.js";
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

/**
 * What read next asks of one stream, worked out once for all its posts: each
 * post's tags and day, which posts carry each tag, which posts link each other,
 * and the stream's newest first. Asking it per post instead made a build of a
 * stream quadratic in its posts, with every pair re-reading tags and dates.
 */
interface StreamFacts {
  posts: Set<string>;
  slugs: Map<string, ReadonlySet<string>>;
  carrying: Map<string, string[]>;
  linked: Map<string, Set<string>>;
  day: Map<string, number>;
  newest: string[];
}

function streamFacts(posts: readonly RenderedPage[]): StreamFacts {
  const facts: StreamFacts = {
    posts: new Set(posts.map((post) => post.sitePath)),
    slugs: new Map(),
    carrying: new Map(),
    linked: new Map(),
    day: new Map(),
    newest: [...posts].sort(newestFirst).map((post) => post.sitePath),
  };
  const link = (a: string, b: string) => {
    if (a === b || !facts.posts.has(a) || !facts.posts.has(b)) return;
    facts.linked.set(a, (facts.linked.get(a) ?? new Set()).add(b));
    facts.linked.set(b, (facts.linked.get(b) ?? new Set()).add(a));
  };
  for (const post of posts) {
    const slugs = pageTagSlugs(post.frontmatter);
    facts.slugs.set(post.sitePath, slugs);
    for (const slug of slugs) {
      const carrying = facts.carrying.get(slug);
      if (carrying === undefined) facts.carrying.set(slug, [post.sitePath]);
      else carrying.push(post.sitePath);
    }
    for (const backlink of post.backlinks) link(post.sitePath, backlink.sitePath);
    const date = pageDate(post);
    facts.day.set(post.sitePath, date === undefined ? Number.NaN : Date.parse(date.slice(0, 10)));
  }
  return facts;
}

/** The posts like `sitePath` in a stream, most alike first (see `relatedPosts`). */
function related(sitePath: string, facts: StreamFacts): string[] {
  const total = facts.posts.size;
  const scores = new Map<string, number>();
  for (const slug of facts.slugs.get(sitePath) ?? []) {
    const carrying = facts.carrying.get(slug) ?? [];
    const weight = Math.log(total / carrying.length);
    for (const other of carrying) if (other !== sitePath) scores.set(other, (scores.get(other) ?? 0) + weight);
  }
  for (const other of facts.linked.get(sitePath) ?? []) scores.set(other, (scores.get(other) ?? 0) + 1);
  const at = facts.day.get(sitePath) ?? Number.NaN;
  const distance = (other: string) => {
    const d = Math.abs((facts.day.get(other) ?? Number.NaN) - at);
    return Number.isNaN(d) ? Number.POSITIVE_INFINITY : d;
  };
  return [...scores.entries()]
    .filter(([, score]) => score > 0)
    .map(([other, score]) => ({ other, score, distance: distance(other) }))
    .sort((a, b) => b.score - a.score || a.distance - b.distance || a.other.localeCompare(b.other))
    .map((entry) => entry.other);
}

/**
 * What to read after each page of a site, as a function of the page: the
 * site's streams are read once, here, so asking for every page of a large
 * stream costs what one pass over it does.
 */
export function readNextPlanner(
  pages: readonly RenderedPage[],
  layout: Layout | undefined,
  index: LinkIndex,
): (page: RenderedPage) => ReadNext {
  const streams = new Map(
    streamPosts(layout, pages).map(({ dir, posts }) => [dir.toLowerCase(), { dir, facts: streamFacts(posts) }]),
  );
  return (page) => {
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
    const stream = dir === undefined ? undefined : streams.get(dir.toLowerCase());
    if (stream === undefined || !stream.facts.posts.has(page.sitePath)) {
      return { sitePaths, chosen: sitePaths.length > 0 };
    }
    const fill = (candidates: Iterable<string | undefined>) => {
      for (const sitePath of candidates) {
        if (sitePaths.length >= READ_NEXT_SLOTS) return;
        add(sitePath);
      }
    };
    fill(streamFeatured(layout, stream.dir).map((sitePath) => index.page(sitePath)));
    const chosen = sitePaths.length > 0;
    fill(related(page.sitePath, stream.facts));
    fill(stream.facts.newest);
    return { sitePaths, chosen };
  };
}

/** What to read after one page — `readNextPlanner` for a single question. */
export function pickReadNext(
  page: RenderedPage,
  pages: readonly RenderedPage[],
  layout: Layout | undefined,
  index: LinkIndex,
): ReadNext {
  return readNextPlanner(pages, layout, index)(page);
}

/**
 * A stream's posts like `page`, most alike first: each tag they share adds
 * `ln(N / df)` — N the stream's posts, df those carrying the tag, so a tag on
 * every post adds nothing — and a link either way adds 1. Only posts that score
 * above zero; a tie goes to the post published nearer, then to its path.
 */
export function relatedPosts(page: RenderedPage, posts: readonly RenderedPage[]): string[] {
  return related(page.sitePath, streamFacts(posts));
}
