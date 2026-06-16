/**
 * Canopy's default design tokens — the visual contract a published site reads.
 *
 * Canopy stays app-agnostic by defining a *vocabulary* of semantic custom
 * properties (colors, type, spacing) rather than importing any app's
 * stylesheet. These defaults let a site look good standalone; a consumer
 * (e.g. textree) can inject its own token stylesheet at publish time — see
 * `emitSite`'s `tokens` option — to make the published site match its app
 * exactly. The names mirror textree's `tokens.css` so that injection is a
 * drop-in, fulfilling the single-source-of-truth principle across both repos
 * without coupling canopy to textree's internals.
 *
 * Dark mode follows `prefers-color-scheme` so static sites adapt with no JS.
 */
export const CANOPY_TOKENS = `:root {
  --font-ui: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
  --font-monospace: "JetBrains Mono", "Cascadia Code", "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;
  --font-size-editor: 16px;
  --line-height-relaxed: 1.7;
  --font-weight-semibold: 600;

  --content-max-width: 48rem;
  --sp-2: 8px;
  --sp-3: 12px;
  --sp-4: 16px;
  --sp-6: 24px;
  --sp-8: 32px;
  --radius-m: 6px;

  --bg-primary: #ffffff;
  --bg-secondary: #f6f7f8;
  --text-normal: #2a2d34;
  --text-muted: #6a707c;
  --text-faint: #868d97;
  --accent: #4a6cf0;
  --accent-hover: #3a5be0;
  --border: rgba(0, 0, 0, 0.1);
  --border-strong: rgba(0, 0, 0, 0.18);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #1e1f23;
    --bg-secondary: #181a1d;
    --text-normal: #dadde2;
    --text-muted: #9aa0aa;
    --text-faint: #6b7178;
    --accent: #6d8bff;
    --accent-hover: #859dff;
    --border: rgba(255, 255, 255, 0.1);
    --border-strong: rgba(255, 255, 255, 0.18);
  }
}
`;
