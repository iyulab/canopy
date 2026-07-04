import type { SiteBundle } from "./contract.js";

/**
 * Site path of the KaTeX stylesheet. The CLI links this into each page's
 * <head> and copies it (with its woff2 fonts) next to the output — but only
 * when the built site actually renders math (see `bundleUsesKatex`). A
 * math-free vault ships none of it, keeping the payload minimal.
 */
export const KATEX_STYLESHEET = "assets/katex.css";

/**
 * Marker that rehype-katex stamps on every rendered formula: inline math is
 * wrapped in `<span class="katex">`, display math in
 * `<span class="katex-display"><span class="katex">…`, and even a render
 * failure carries `<span class="katex-error" …>` — all of which start with
 * this exact opening-tag prefix.
 *
 * The prefix includes the `<span ` on purpose. A bare `class="katex` substring
 * is forgeable by authored content, because rehype-stringify does NOT escape
 * `"` inside text, so a code span `` `class="katex"` `` renders the literal
 * bytes `<code>class="katex"</code>`. Anchoring on the opening tag closes that:
 *  - Code spans escape `<` to `&#x3C;`, so `<span` never appears literally.
 *  - Raw `<span class="katex">` in prose has its `class` stripped by
 *    rehype-sanitize (katex is not in the allowlist) → `<span>`.
 *
 * The result is both safe and precise:
 *  - No false negatives for real math (the case that matters): KaTeX always
 *    emits this wrapper, so gating assets on it can never drop the stylesheet a
 *    page needs.
 *  - No forgery from authored prose or code (verified against real output).
 *  - Any residual false positive would only re-emit assets a math-free site
 *    does not need — status-quo-safe, never broken output.
 */
const KATEX_MARKER = '<span class="katex';

/** True when any page in the bundle emitted KaTeX HTML. */
export function bundleUsesKatex(bundle: SiteBundle): boolean {
  return bundle.pages.some((page) => page.html.includes(KATEX_MARKER));
}
