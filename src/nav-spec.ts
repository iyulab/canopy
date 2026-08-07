import type { NavEntry, NavNode } from "./navigation.js";
import { pageName } from "./title.js";

/**
 * An externally supplied navigation order.
 *
 * Canopy derives navigation from paths, which fixes it to one shape: folders
 * before pages, each alphabetical, folder labels taken from directory names.
 * That is a reasonable default and the wrong answer for any document set with a
 * canonical order of its own — a release log reads newest-first, a guide reads
 * in teaching order — and directory names are URL segments, not display text.
 *
 * A spec supplies both. Canopy applies it and knows nothing about where it came
 * from: hand-written, generated, or emitted by a tool are all the same here.
 */
export interface NavSpec {
  /** Top-level items, in display order. */
  items: NavSpecItem[];
}

/**
 * One entry: either a page (`path`) or a group of entries (`items`).
 *
 * A group may also carry a `path`, which makes its label link to that page —
 * the same thing a folder's `index.md` does in the derived tree.
 */
export interface NavSpecItem {
  /** Display text. Defaults to the page's title, then its filename stem. */
  label?: string;
  /** Vault-relative path of the page, with or without its extension. */
  path?: string;
  /** Nested entries, in display order. */
  items?: NavSpecItem[];
}

/** Why a spec was rejected, phrased for someone editing the file. */
export class NavSpecError extends Error {}

function fail(message: string): never {
  throw new NavSpecError(message);
}

/** Normalize a spec path to the site path it addresses. */
function toSitePathKey(path: string): string {
  return path
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\.(md|html)$/i, "")
    .toLowerCase();
}

function validateItem(item: unknown, where: string): NavSpecItem {
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    fail(`${where}: expected an object with "label", "path", or "items"`);
  }
  const { label, path, items } = item as Record<string, unknown>;
  if (label !== undefined && typeof label !== "string") {
    fail(`${where}: "label" must be a string`);
  }
  if (path !== undefined && typeof path !== "string") {
    fail(`${where}: "path" must be a string`);
  }
  if (items !== undefined && !Array.isArray(items)) {
    fail(`${where}: "items" must be an array`);
  }
  if (path === undefined && items === undefined) {
    fail(`${where}: needs a "path" (a page) or "items" (a group)`);
  }
  // A group with no label would render as an unnamed heading, which reads as a
  // rendering bug rather than as the authoring mistake it is.
  if (path === undefined && label === undefined) {
    fail(`${where}: a group needs a "label"`);
  }

  const children = ((items as unknown[]) ?? []).map((child, i) =>
    validateItem(child, `${where} > items[${i}]`),
  );
  return {
    ...(label === undefined ? {} : { label }),
    ...(path === undefined ? {} : { path }),
    ...(items === undefined ? {} : { items: children }),
  };
}

/**
 * Parse and validate a navigation spec from JSON text.
 *
 * Validation is strict and its messages name the offending position, because
 * this file is hand-edited: a spec that is silently half-applied would look like
 * canopy ignoring the order it was given.
 */
export function parseNavSpec(json: string): NavSpec {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    fail(`not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    fail('expected an object with an "items" array');
  }
  const { items } = raw as Record<string, unknown>;
  if (!Array.isArray(items)) {
    fail('"items" must be an array');
  }
  return { items: items.map((item, i) => validateItem(item, `items[${i}]`)) };
}

/** Pages placed by a spec, plus the ones it left out. */
export interface AppliedNav {
  nodes: NavNode[];
  /** Site paths in the build that the spec never mentioned. */
  unplaced: string[];
  /** Spec paths that match no page in the build. */
  missing: string[];
}

/**
 * Turn a spec plus this build's pages into a navigation tree.
 *
 * Order is the spec's order, verbatim — no sorting is applied, since supplying
 * an order is the entire point. Labels fall back to the page's title and then
 * its filename stem, so a spec only has to name what it wants to override.
 *
 * Pages the spec omits are reported rather than dropped or appended: whether a
 * missing page is an oversight or a deliberate omission is the caller's call,
 * not canopy's.
 */
export function applyNavSpec(spec: NavSpec, entries: readonly NavEntry[]): AppliedNav {
  const byKey = new Map<string, NavEntry>();
  for (const entry of entries) {
    byKey.set(toSitePathKey(entry.sitePath), entry);
  }

  const placed = new Set<string>();
  const missing: string[] = [];

  const build = (items: readonly NavSpecItem[]): NavNode[] => {
    const nodes: NavNode[] = [];
    for (const item of items) {
      const children = build(item.items ?? []);
      let entry: NavEntry | undefined;
      if (item.path !== undefined) {
        const key = toSitePathKey(item.path);
        entry = byKey.get(key);
        if (entry === undefined) {
          missing.push(item.path);
          // A group still renders without its own page; a leaf has nothing left.
          if (item.items === undefined) {
            continue;
          }
        } else {
          placed.add(entry.sitePath);
        }
      }
      // A spec supplies an order, not a different vocabulary: an entry it does
      // not label is named exactly as the derived tree would name it.
      const label =
        item.label ??
        (entry === undefined ? "" : pageName(entry.sitePath, entry.title));
      nodes.push({
        label,
        ...(entry === undefined ? {} : { sitePath: entry.sitePath }),
        children,
      });
    }
    return nodes;
  };

  const nodes = build(spec.items);
  const unplaced = entries
    .map((entry) => entry.sitePath)
    .filter((sitePath) => !placed.has(sitePath));
  return { nodes, unplaced, missing };
}
