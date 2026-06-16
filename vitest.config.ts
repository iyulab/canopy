import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The render pipeline lazily initializes Shiki (oniguruma WASM + the
    // light/dark themes) on the first build()/renderMarkdown() call. On a cold
    // runner that single first call already exceeds Vitest's 5s default, so the
    // first Shiki-using test in each file times out (observed ~7s in CI, and
    // reproducible locally with a cold cache). Raise the ceiling so the cost of
    // a legitimate one-time WASM warm-up is not mistaken for a hang. This lifts
    // the timeout, not the cost — narrowing the Shiki language bundle is tracked
    // separately as an after-measured-demand optimization.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
