import { parse as parseYaml } from "yaml";

/** A markdown document split into its frontmatter data and body. */
export interface ParsedDocument {
  /** Parsed YAML frontmatter, or an empty object when absent. */
  data: Record<string, unknown>;
  /** Markdown body with the frontmatter block removed. */
  body: string;
}

/**
 * Leading `---` fenced YAML frontmatter block. Anchored at the very start of
 * the document, so a `---` thematic break further down is never mistaken for
 * frontmatter. The closing fence may carry trailing spaces/tabs.
 */
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n?---[ \t]*\r?\n?/;

/**
 * Split a raw markdown document into its YAML frontmatter and body.
 *
 * Pure and deterministic. A document without a leading frontmatter fence is
 * returned untouched with empty data. Non-object YAML (a bare scalar or list)
 * is treated as no usable frontmatter, since page metadata is a key/value map.
 */
export function parseFrontmatter(raw: string): ParsedDocument {
  const match = FRONTMATTER.exec(raw);
  if (!match) {
    return { data: {}, body: raw };
  }
  const yamlSource = match[1] ?? "";
  const body = raw.slice(match[0].length);
  const parsed = parseYaml(yamlSource) as unknown;
  const data =
    parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  return { data, body };
}
