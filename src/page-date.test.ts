import { describe, expect, it } from "vitest";
import { formatPageDate, frontmatterDate } from "./page-date.js";

describe("frontmatterDate", () => {
  it("keeps a date-only value date-only", () => {
    expect(frontmatterDate("2026-09-28")).toBe("2026-09-28");
    expect(frontmatterDate("  2026-09-28 ")).toBe("2026-09-28");
  });

  it("accepts a date-time with or without an offset, normalizing the separator", () => {
    expect(frontmatterDate("2026-09-28T09:30:00+09:00")).toBe("2026-09-28T09:30:00+09:00");
    expect(frontmatterDate("2026-09-28T09:30Z")).toBe("2026-09-28T09:30Z");
    expect(frontmatterDate("2026-09-28 09:30:00")).toBe("2026-09-28T09:30:00");
  });

  it("accepts the Date a YAML timestamp parses into", () => {
    expect(frontmatterDate(new Date(Date.UTC(2026, 8, 28)))).toBe("2026-09-28");
    expect(frontmatterDate(new Date(Date.UTC(2026, 8, 28, 9, 30)))).toBe("2026-09-28T09:30:00.000Z");
    expect(frontmatterDate(new Date(Number.NaN))).toBeUndefined();
  });

  it("refuses anything that is not a real day", () => {
    for (const value of ["2026-02-30", "2026-13-01", "28/09/2026", "2026-09-28 later", "2026-09-28T25:00", "", 20260928, null, undefined]) {
      expect(frontmatterDate(value)).toBeUndefined();
    }
  });
});

describe("formatPageDate", () => {
  it("spells the day the author wrote in the site language", () => {
    const expected = (locale: string): string =>
      new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(
        new Date(Date.UTC(2026, 8, 28)),
      );
    expect(formatPageDate("2026-09-28", "en")).toBe(expected("en"));
    expect(formatPageDate("2026-09-28", "ko-KR")).toBe(expected("ko-KR"));
    // The written day, not the same instant re-read in UTC (still the 27th there).
    expect(formatPageDate("2026-09-28T01:00+09:00", "en")).toBe(expected("en"));
  });

  it("falls back to English for a language tag Intl cannot use", () => {
    expect(formatPageDate("2026-09-28", '"><x')).toBe(formatPageDate("2026-09-28", "en"));
  });
});
