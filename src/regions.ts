import type { Element, ElementContent, Root, RootContent } from "hast";
import { fromHtml } from "hast-util-from-html";
import { toHtml } from "hast-util-to-html";
import type { RenderedPage } from "./contract.js";
import { type Layout, type RegionName, resolvePageLayout } from "./layout.js";
import { decodeLinkPath, isExternalUrl, parseLinkUrl } from "./markdown-link.js";
import { relativeHref } from "./site-path.js";

/**
 * A caller's region fragments, and the slots that place canopy's own controls
 * inside them.
 *
 * A fragment is the caller's markup, carried as written — a site's own header
 * keeps its own design system's classes and structure — with two things done to
 * it at build time. Its links, written from the site root, are rewritten
 * relative to each page, the way every other link canopy writes is. And each
 * `<canopy-slot name="…">` is replaced: a control slot by the markup canopy
 * already draws for that control (so its public hooks, and any script built on
 * them, keep working), a `page:<key>` slot by that page's own frontmatter text.
 * Nothing of the slot reaches the browser, and canopy writes no script for it.
 *
 * The slot names are a closed set and part of canopy's public contract
 * (docs/THEMING.md): an unknown one fails the build rather than leaving a hole
 * where something was expected.
 */

/** The controls a fragment can place. */
export const CONTROL_SLOTS = [
  "site-title",
  "home",
  "back",
  "breadcrumb",
  "language",
  "search",
  "theme-toggle",
  "skip-link",
] as const;
export type ControlSlot = (typeof CONTROL_SLOTS)[number];

const SLOT_TAG = "canopy-slot";
const PAGE_PREFIX = "page:";

/** A fragment or a page value that cannot be used, phrased for whoever wrote it. */
export class FragmentError extends Error {}

function isControlSlot(name: string): name is ControlSlot {
  return (CONTROL_SLOTS as readonly string[]).includes(name);
}

function parse(html: string): Root {
  return fromHtml(html, { fragment: true });
}

function slotName(element: Element): string {
  const name = element.properties.name;
  return typeof name === "string" ? name : "";
}

/** Whether a slot holds anything a reader would see — markup, or text that is not just space. */
function hasContent(element: Element): boolean {
  return element.children.some(
    (child) => child.type === "element" || (child.type === "text" && child.value.trim() !== ""),
  );
}

/** Every element of a tree in document order, with whether it sits inside a slot. */
function* elements(nodes: readonly (RootContent | ElementContent)[], inSlot = false): Generator<[Element, boolean]> {
  for (const node of nodes) {
    if (node.type !== "element") continue;
    yield [node, inSlot];
    yield* elements(node.children, inSlot || node.tagName === SLOT_TAG);
  }
}

/**
 * What is wrong with a fragment used in `region`, one message per slot, in
 * document order. Empty when the fragment can be rendered.
 */
export function fragmentProblems(html: string, region: RegionName): string[] {
  const problems: string[] = [];
  // HTML does not close a custom element on "/>", so a slot written that way
  // takes in everything after it. Found in the source: the parsed tree cannot
  // tell it from a slot that was opened and left unclosed.
  const selfClosing = new Set([...html.matchAll(/<canopy-slot\b[^>]*\/\s*>/gi)].map((match) => match.index));
  for (const [element, inSlot] of elements(parse(html).children)) {
    if (element.tagName !== SLOT_TAG) continue;
    const name = slotName(element);
    const tag = name === "" ? "<canopy-slot>" : `<canopy-slot name="${name}">`;
    if (name === "") {
      problems.push(`${tag} needs a name`);
    } else if (inSlot) {
      problems.push(`${tag} sits inside another slot — slots do not nest`);
    } else if (region === "head") {
      problems.push(
        `${tag} cannot sit in the head region — nothing there is shown to a reader, ` +
          "and text inside <script> or <title> is not HTML a slot could become",
      );
    } else if (name.startsWith(PAGE_PREFIX) && name.length === PAGE_PREFIX.length) {
      problems.push(`${tag} needs a frontmatter key after "page:"`);
    } else if (!name.startsWith(PAGE_PREFIX) && !isControlSlot(name)) {
      problems.push(
        `unknown slot "${name}" — slots are ${CONTROL_SLOTS.join(", ")}, or page:<frontmatter key>`,
      );
    } else if (selfClosing.has(element.position?.start.offset ?? -1) || (isControlSlot(name) && hasContent(element))) {
      problems.push(
        `${tag} must be empty — write it as <canopy-slot name="${name}"></canopy-slot>; ` +
          "HTML does not close a self-closing custom tag, so it takes in what follows",
      );
    }
  }
  return problems;
}

/** The frontmatter keys a fragment's `page:` slots read, each once, in order. */
export function pageSlotKeys(html: string): string[] {
  const keys: string[] = [];
  for (const [element] of elements(parse(html).children)) {
    if (element.tagName !== SLOT_TAG) continue;
    const name = slotName(element);
    if (!name.startsWith(PAGE_PREFIX)) continue;
    const key = name.slice(PAGE_PREFIX.length);
    if (key !== "" && !keys.includes(key)) keys.push(key);
  }
  return keys;
}

/** The control slots a fragment places, each once, in document order. */
export function fragmentControls(html: string): ControlSlot[] {
  const found: ControlSlot[] = [];
  for (const [element] of elements(parse(html).children)) {
    if (element.tagName !== SLOT_TAG) continue;
    const name = slotName(element);
    if (isControlSlot(name) && !found.includes(name)) found.push(name);
  }
  return found;
}

/** The attributes whose value is one URL. */
const URL_ATTRIBUTES = ["href", "src", "poster", "action"] as const;

/**
 * The candidates of a `srcset`: each URL with whatever follows it up to the next
 * comma (its width or density descriptor). A comma ends a URL only when it
 * follows whitespace or a descriptor, as in the HTML parsing rules, so a URL
 * that itself holds a comma stays whole.
 */
function srcsetCandidates(value: string): { url: string; descriptor: string }[] {
  const candidates: { url: string; descriptor: string }[] = [];
  let rest = value;
  for (;;) {
    rest = rest.replace(/^[\s,]+/, "");
    if (rest === "") return candidates;
    const url = (/^\S+/.exec(rest) as RegExpExecArray)[0];
    rest = rest.slice(url.length);
    if (url.endsWith(",")) {
      candidates.push({ url: url.replace(/,+$/, ""), descriptor: "" });
      continue;
    }
    const end = rest.indexOf(",");
    const descriptor = (end === -1 ? rest : rest.slice(0, end)).trim();
    rest = end === -1 ? "" : rest.slice(end + 1);
    candidates.push({ url, descriptor });
  }
}

/** Every URL a fragment holds — `href`, `src`, `poster`, `action` and each `srcset` candidate — in document order, as written. */
export function fragmentLinks(html: string): string[] {
  const links: string[] = [];
  for (const [element] of elements(parse(html).children)) {
    for (const attribute of URL_ATTRIBUTES) {
      const value = element.properties[attribute];
      if (typeof value === "string") links.push(value);
    }
    const srcset = element.properties.srcSet;
    if (typeof srcset === "string") links.push(...srcsetCandidates(srcset).map((candidate) => candidate.url));
  }
  return links;
}

/**
 * A fragment link, written from the site root, as seen from the page at `from`.
 *
 * Anything that already says where it goes — a scheme, `//host`, `#id`, or a
 * root-absolute `/path` — is left exactly as written, by the same rule every
 * other link canopy writes follows (`isExternalUrl`). A link to a folder
 * (`blog/`) stays a folder link, and from inside that folder becomes `./` —
 * the empty href `relativeHref` would give means "this page", not the folder.
 */
export function fragmentHref(from: string, url: string): string {
  if (isExternalUrl(url)) return url;
  const { path, suffix } = parseLinkUrl(url);
  const target = (decodeLinkPath(path) ?? path).replace(/^\.\//, "");
  if (target === "") return url;
  if (target.endsWith("/")) {
    const href = relativeHref(from, `${target}index.html`).replace(/(^|\/)index\.html$/, "$1");
    return (href === "" ? "./" : href) + suffix;
  }
  return relativeHref(from, target) + suffix;
}

/** What a fragment needs from the page it is rendered into. */
export interface FragmentContext {
  /** Site path of the page, for rewriting links. */
  from: string;
  /** The markup for a control on this page; `""` when it has nothing to show here. */
  control(name: ControlSlot): string;
  /** The page's text for a `page:` slot, `undefined` to use the slot's fallback. */
  page(key: string): string | undefined;
}

/**
 * Render a fragment into one page: links rewritten, slots replaced.
 *
 * Canopy's control markup goes in as raw HTML — it is canopy's own, already
 * escaped where it carries text. A page value goes in as text, escaped, since
 * it is the author's words and not markup.
 */
export function renderFragment(html: string, context: FragmentContext): string {
  const replace = (nodes: readonly (RootContent | ElementContent)[]): RootContent[] =>
    nodes.flatMap((node): RootContent[] => {
      if (node.type !== "element") return [node];
      if (node.tagName === SLOT_TAG) {
        const name = slotName(node);
        if (name.startsWith(PAGE_PREFIX)) {
          const value = context.page(name.slice(PAGE_PREFIX.length));
          return value === undefined ? replace(node.children) : [{ type: "text", value }];
        }
        if (!isControlSlot(name)) throw new FragmentError(`unknown slot "${name}"`);
        const markup = context.control(name);
        // hast-util-to-html writes a `raw` node verbatim when allowDangerousHtml
        // is set; the type lives in mdast-util-to-hast's augmentation of hast.
        return markup === "" ? [] : [{ type: "raw", value: markup } as unknown as RootContent];
      }
      for (const attribute of URL_ATTRIBUTES) {
        const value = node.properties[attribute];
        if (typeof value === "string") node.properties[attribute] = fragmentHref(context.from, value);
      }
      const srcset = node.properties.srcSet;
      if (typeof srcset === "string") {
        node.properties.srcSet = srcsetCandidates(srcset)
          .map(({ url, descriptor }) => `${fragmentHref(context.from, url)} ${descriptor}`.trim())
          .join(", ");
      }
      node.children = replace(node.children) as ElementContent[];
      return [node];
    });
  const tree = parse(html);
  tree.children = replace(tree.children);
  return toHtml(tree, { allowDangerousHtml: true });
}

function describe(value: unknown): string {
  if (Array.isArray(value)) return "a list";
  if (value instanceof Date) return "a date";
  if (typeof value === "object") return "an object";
  return `a ${typeof value}`;
}

/**
 * A page's text for `<canopy-slot name="page:<key>">`: its frontmatter string,
 * or `undefined` when the key is absent or blank (the slot's fallback shows).
 *
 * Anything else is refused rather than stringified — a list, a number, or a
 * YAML date would otherwise reach the reader as `a,b`, `3`, or a timestamp the
 * author never wrote.
 */
export function pageSlotText(frontmatter: Record<string, unknown>, key: string): string | undefined {
  const value = frontmatter[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new FragmentError(
      `frontmatter "${key}" must be text to fill <canopy-slot name="page:${key}">, not ${describe(value)}`,
    );
  }
  return value.trim() === "" ? undefined : value;
}

/**
 * Every page whose frontmatter cannot fill a `page:` slot that reaches it, one
 * message per page and key — checked before anything is written, so a build
 * fails naming the page rather than partway through emitting the site.
 */
export function pageSlotProblems(
  pages: readonly RenderedPage[],
  layout: Layout | undefined,
  fragments: Readonly<Record<string, string>>,
): string[] {
  const keysOf = new Map(Object.entries(fragments).map(([file, html]) => [file, pageSlotKeys(html)]));
  const problems: string[] = [];
  for (const page of pages) {
    const keys = new Set(
      Object.values(resolvePageLayout(layout, page.sitePath).regions).flatMap((file) => keysOf.get(file) ?? []),
    );
    for (const key of keys) {
      try {
        pageSlotText(page.frontmatter, key);
      } catch (error) {
        problems.push(`${page.sourcePath || page.sitePath}: ${(error as Error).message}`);
      }
    }
  }
  return problems;
}
