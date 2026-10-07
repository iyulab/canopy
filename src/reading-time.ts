/**
 * How long a page takes to read, in whole minutes — the "N min read" a stream
 * page shows under its title and beside each entry of its list.
 *
 * Words are found with the runtime's own word segmentation for the page's
 * language, so a language that separates words with spaces (English, Korean)
 * is read by the word. Chinese and Japanese are read by the character, since a
 * "word" there is whatever the segmenter's dictionary says and a reader's pace
 * follows the characters. The two rates are stated constants rather than
 * calibrated per page: an estimate a reader can trust to be the same rule on
 * every page beats one that is cleverer on some.
 */

const WORDS_PER_MINUTE = 230;
const CHARACTERS_PER_MINUTE = 500;

/**
 * Han ideographs and kana — the scripts read by the character. Hangul is read
 * by the word. Named by script rather than by code-point block, so every block
 * of them counts (extension B and later lie outside the Basic Multilingual
 * Plane), and by script extension, so the marks used only within them — "々",
 * the prolonged-sound "ー" — count with them.
 */
const BY_CHARACTER = /[\p{scx=Han}\p{scx=Hiragana}\p{scx=Katakana}]/gu;

function segmenter(lang: string): Intl.Segmenter {
  try {
    return new Intl.Segmenter(lang, { granularity: "word" });
  } catch {
    return new Intl.Segmenter("en", { granularity: "word" });
  }
}

/** Minutes to read `text` (plain text, not HTML) written in `lang`; never less than one. */
export function readingMinutes(text: string, lang: string): number {
  let words = 0;
  let characters = 0;
  for (const { segment, isWordLike } of segmenter(lang).segment(text)) {
    if (!isWordLike) continue;
    const ideographic = segment.match(BY_CHARACTER)?.length ?? 0;
    if (ideographic > 0) characters += ideographic;
    else words += 1;
  }
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE + characters / CHARACTERS_PER_MINUTE));
}
