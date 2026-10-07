/**
 * Dates a page states about itself — `date:` (when it was published) and
 * `updated:` (when it last changed in substance) in its frontmatter, or a
 * publish day its file name begins with.
 *
 * One rule for what counts as a date, so every reader of the same page — the
 * shell's visible date, the `<head>` tags, a stream's order, a feed, a
 * caller's sitemap or check — agrees on which pages are dated and what their
 * dates are.
 */

/** `YYYY-MM-DD`, optionally followed by a time and an offset (ISO 8601 / RFC 3339). */
const ISO_DATE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/i;

/** Whether year/month/day name a day that exists (rejects 2026-02-30). */
function isCalendarDay(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/**
 * A frontmatter value as an ISO 8601 date or date-time, or `undefined` when it
 * does not name one.
 *
 * Accepts the two shapes a YAML parser hands back: a string (`2026-09-28`,
 * `2026-09-28T09:30:00+09:00`) and a `Date` (YAML's timestamp type). A
 * date-only value stays date-only — a page that names a day does not acquire a
 * midnight it never stated. Anything else, including an impossible day, is not
 * a date: a wrong claim about when a page was published is worse than none.
 */
export function frontmatterDate(value: unknown): string | undefined {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    const iso = value.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso;
  }
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  const match = ISO_DATE.exec(text);
  if (match === null) return undefined;
  const [, year, month, day, hour, minute, second] = match;
  if (!isCalendarDay(Number(year), Number(month), Number(day))) return undefined;
  if (hour !== undefined && (Number(hour) > 23 || Number(minute) > 59 || Number(second ?? 0) > 59)) {
    return undefined;
  }
  return text.replace(" ", "T");
}

/** A file name's leading day: `2026-10-03-launch.md`, `2026-10-03.md`. */
const FILE_NAME_DAY = /^(\d{4}-\d{2}-\d{2})(?:[-_ .]|$)/;

/**
 * The publish day a page's file name begins with, or `undefined`.
 *
 * Naming a post by its day (`2026-10-03-launch.md`) is how many blogs keep
 * their folder in order and their date visible in the URL; that name is the
 * author's own statement of the day, as much as a `date:` line is. A leading
 * day that does not exist (`2026-02-30-…`) is not a date, the same rule
 * `frontmatterDate` applies.
 */
export function fileNameDate(sourcePath: string): string | undefined {
  const stem = sourcePath.replace(/\\/g, "/").split("/").pop()?.replace(/\.md$/i, "") ?? "";
  const match = FILE_NAME_DAY.exec(stem);
  return match === null ? undefined : frontmatterDate(match[1]);
}

/**
 * When a page was published: its `date:`, or else the day its file name
 * begins with. `date:` wins when both are there — it can carry a time, and it
 * is the one line an author edits to re-date a post without renaming it (a
 * renamed file is a changed URL). A caller checking a site can compare the
 * two with `frontmatterDate` and `fileNameDate` and report a disagreement.
 */
export function pageDate(page: { sourcePath: string; frontmatter: Record<string, unknown> }): string | undefined {
  return frontmatterDate(page.frontmatter.date) ?? fileNameDate(page.sourcePath);
}

/** Pages in a stream's order: newest first, an undated page last, a tie by site path. */
export function newestFirst(
  a: { sourcePath: string; sitePath: string; frontmatter: Record<string, unknown> },
  b: { sourcePath: string; sitePath: string; frontmatter: Record<string, unknown> },
): number {
  return (pageDate(b) ?? "").localeCompare(pageDate(a) ?? "") || a.sitePath.localeCompare(b.sitePath);
}

/**
 * The calendar day of an ISO date as a reader in `lang` writes it —
 * "September 28, 2026", "2026년 9월 28일".
 *
 * The day is the one the author wrote, not that instant re-read in some
 * timezone: `2026-09-28T01:00+09:00` is the 28th where it was written, even
 * though it is still the 27th in UTC. An unusable `lang` falls back to English
 * rather than failing the build over the date's spelling.
 */
export function formatPageDate(iso: string, lang: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return dateFormat(lang).format(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1)));
}

/** One formatter per language: a site's every listed date is spelled by the same one. */
const dateFormats = new Map<string, Intl.DateTimeFormat>();

function dateFormat(lang: string): Intl.DateTimeFormat {
  let format = dateFormats.get(lang);
  if (format === undefined) {
    let locale = "en";
    try {
      locale = Intl.getCanonicalLocales(lang)[0] ?? "en";
    } catch {
      // A malformed tag — `<html lang>` still carries it as given; only the
      // date's spelling needs a locale Intl accepts.
    }
    format = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" });
    dateFormats.set(lang, format);
  }
  return format;
}
