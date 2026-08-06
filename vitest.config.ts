import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Shiki's highlighter (oniguruma WASM + every grammar in the default bundle)
    // is built lazily, on the render pipeline's first call. Measured on this
    // suite: that call costs ~11s, every later one ~10ms. The cost is the
    // *grammar set* — the same pipeline restricted to one language warms up in
    // ~5ms — so it is paid once per worker, and Vitest gives each test file its
    // own worker.
    //
    // Run in parallel, those warm-ups contend for the same cores until they
    // cross the timeout below: 5-7 files failed per run with the failing *set*
    // varying between runs, which is resource contention rather than a broken
    // test. Serially the suite passes in full.
    fileParallelism: false,

    // Headroom for one cold warm-up per file. ~11s is the healthy figure, but it
    // degrades sharply under contention — a loaded machine has been seen to
    // stretch it by an order of magnitude — so this ceiling holds in normal
    // conditions rather than in all of them.
    //
    // The fix is to stop loading every grammar up front, which removes the
    // warm-up and its sensitivity together. That changes how an unknown language
    // behaves (today it degrades to a plain code block; a narrowed bundle
    // throws), so it needs a fallback and its own commit.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
