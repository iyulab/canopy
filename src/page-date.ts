/**
 * Dates a page states about itself in its frontmatter — `date:` (when it was
 * published) and `updated:` (when it last changed in substance).
 *
 * One rule for what counts as a date, so every reader of the same frontmatter
 * — the shell's visible date, the `<head>` tags, a caller's sitemap or check —
 * agrees on which pages are dated and what their dates are.
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
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  let locale = "en";
  try {
    locale = Intl.getCanonicalLocales(lang)[0] ?? "en";
  } catch {
    // A malformed tag — `<html lang>` still carries it as given; only the
    // date's spelling needs a locale Intl accepts.
  }
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(date);
}
