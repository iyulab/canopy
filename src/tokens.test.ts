import { describe, expect, it } from "vitest";
import { CANOPY_TOKENS } from "./tokens.js";

describe("CANOPY_TOKENS", () => {
  it("still adapts to the system preference by default", () => {
    expect(CANOPY_TOKENS).toContain("@media (prefers-color-scheme: dark)");
  });

  it("lets an explicit data-theme override the system preference", () => {
    // The media-query block must exempt an explicit light override, or a
    // caller's script could never force light on a dark-preferring system.
    expect(CANOPY_TOKENS).toContain(':root:not([data-theme="light"])');
    // And a caller must be able to force dark regardless of system preference.
    expect(CANOPY_TOKENS).toContain(':root[data-theme="dark"]');
  });

  it("declares the dark palette identically in both paths", () => {
    // Both the system-preference block and the explicit-override block read
    // from the same DARK_TOKENS constant — this is the observable proof:
    // a value from it appears twice, once per path.
    const occurrences = CANOPY_TOKENS.split("--bg-primary: #1e1f23;").length - 1;
    expect(occurrences).toBe(2);
  });
});
