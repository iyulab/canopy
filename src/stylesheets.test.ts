import { describe, expect, it } from "vitest";
import { callerStylesheetPath, inCanopyLayer } from "./stylesheets.js";
import { BASE_CSS } from "./styles.js";
import { CANOPY_TOKENS } from "./tokens.js";

describe("inCanopyLayer", () => {
  it("wraps a stylesheet in the canopy cascade layer, contents unchanged", () => {
    expect(inCanopyLayer("a { color: red; }")).toBe("@layer canopy {\na { color: red; }\n}\n");
  });

  // @import and @charset are only valid at the top of a stylesheet; wrapped in a
  // layer block they are dropped, silently. Canopy's own CSS must never carry one.
  it("is safe for canopy's own stylesheets, which carry no top-level-only rule", () => {
    for (const css of [BASE_CSS, CANOPY_TOKENS]) {
      expect(css).not.toMatch(/@import|@charset/);
    }
  });
});

describe("callerStylesheetPath", () => {
  it("numbers caller stylesheets from 1, under assets/", () => {
    expect(callerStylesheetPath(0)).toBe("assets/stylesheet-1.css");
    expect(callerStylesheetPath(2)).toBe("assets/stylesheet-3.css");
  });
});
