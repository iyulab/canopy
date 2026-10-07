import { describe, expect, it } from "vitest";
import { readingMinutes } from "./reading-time.js";

const words = (n: number, word = "word") => Array.from({ length: n }, () => word).join(" ");

describe("readingMinutes", () => {
  it("is at least one minute", () => {
    expect(readingMinutes("", "en")).toBe(1);
  });

  it("counts words at 230 a minute, rounding up", () => {
    expect(readingMinutes(words(460), "en")).toBe(2);
    expect(readingMinutes(words(461), "en")).toBe(3);
  });

  // Korean separates words with spaces, so it is read by the word like English.
  it("counts Korean by its words", () => {
    expect(readingMinutes(words(230, "한국어"), "ko")).toBe(1);
    expect(readingMinutes(words(231, "한국어"), "ko")).toBe(2);
  });

  it("counts Chinese and Japanese by the character, at 500 a minute", () => {
    expect(readingMinutes("字".repeat(500), "zh")).toBe(1);
    expect(readingMinutes("字".repeat(501), "zh")).toBe(2);
    expect(readingMinutes("かな".repeat(300), "ja")).toBe(2);
  });

  // Every ideograph and kana counts, not only those in the most common blocks:
  // CJK extension B lies outside the Basic Multilingual Plane, "々" repeats the
  // ideograph before it, and half-width katakana is still katakana.
  it("counts ideographs and kana outside the common blocks by the character too", () => {
    expect(readingMinutes("𠀋".repeat(501), "zh")).toBe(2);
    expect(readingMinutes("人々".repeat(250), "ja")).toBe(1);
    expect(readingMinutes("人々".repeat(251), "ja")).toBe(2);
    expect(readingMinutes("ｶﾀｶﾅ".repeat(126), "ja")).toBe(2);
  });

  it("adds the two in mixed text", () => {
    expect(readingMinutes(`${words(115)} ${"字".repeat(250)}`, "en")).toBe(1);
    expect(readingMinutes(`${words(116)} ${"字".repeat(250)}`, "en")).toBe(2);
  });

  it("falls back to English word rules for a tag the runtime does not know", () => {
    expect(readingMinutes(words(231), "not a tag")).toBe(2);
  });
});
