import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // A ceiling for a machine under load, not a figure a healthy run approaches.
    //
    // The first test in each file pays for the render pipeline: loading the
    // module graph and creating a highlighter. On an idle machine that is a
    // fraction of a second. On a busy one — a shared CI runner, a laptop whose
    // antivirus scans every file a new process opens — the same work has been
    // measured more than an order of magnitude slower, and files run in
    // parallel compete for what is left. Test files pass individually there and
    // fail together, which is contention rather than a broken test.
    //
    // This is not the grammar warm-up that once made the suite serial: that
    // cost is gone, grammars load on demand, and files run in parallel again.
    // What is left is process and module loading, which no change here removes.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
