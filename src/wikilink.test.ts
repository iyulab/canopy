import { describe, expect, it } from "vitest";
import { parseWikiTarget } from "./wikilink.js";

describe("parseWikiTarget", () => {
  it("parses a bare target", () => {
    expect(parseWikiTarget("idea")).toEqual({
      target: "idea",
      heading: undefined,
      alias: undefined,
    });
  });

  it("parses an alias", () => {
    expect(parseWikiTarget("idea|Bright Idea")).toEqual({
      target: "idea",
      heading: undefined,
      alias: "Bright Idea",
    });
  });

  it("parses a heading", () => {
    expect(parseWikiTarget("idea#Goals")).toEqual({
      target: "idea",
      heading: "Goals",
      alias: undefined,
    });
  });

  it("parses heading and alias together", () => {
    expect(parseWikiTarget("notes/idea#Goals|see goals")).toEqual({
      target: "notes/idea",
      heading: "Goals",
      alias: "see goals",
    });
  });

  it("handles a same-page heading link (empty target)", () => {
    expect(parseWikiTarget("#Goals")).toEqual({
      target: "",
      heading: "Goals",
      alias: undefined,
    });
  });
});
