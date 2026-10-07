import { describe, expect, it } from "vitest";
import { buildLinkIndex } from "./links.js";

describe("buildLinkIndex", () => {
  it("resolves a bare name to its site path (case-insensitive)", () => {
    const index = buildLinkIndex(["notes/idea.html", "about.html"]);
    expect(index.resolve("idea")).toBe("notes/idea.html");
    expect(index.resolve("IDEA")).toBe("notes/idea.html");
  });

  it("resolves a path reference", () => {
    const index = buildLinkIndex(["notes/idea.html"]);
    expect(index.resolve("notes/idea")).toBe("notes/idea.html");
    expect(index.resolve("notes/idea.md")).toBe("notes/idea.html");
  });

  it("returns undefined for an unknown target", () => {
    const index = buildLinkIndex(["a.html"]);
    expect(index.resolve("missing")).toBeUndefined();
  });

  it("resolves name conflicts deterministically (shortest path, then lexicographic)", () => {
    const index = buildLinkIndex(["z/note.html", "a/note.html", "note.html"]);
    // Shortest path wins regardless of input order.
    expect(index.resolve("note")).toBe("note.html");
    const deeper = buildLinkIndex(["z/note.html", "a/note.html"]);
    expect(deeper.resolve("note")).toBe("a/note.html"); // tie -> lexicographic
  });

  it("answers a page path with the build's own spelling of it, matched ignoring case", () => {
    const index = buildLinkIndex(["guide/install.html", "Notes/Idea.html"]);
    expect(index.page("guide/install.html")).toBe("guide/install.html");
    expect(index.page("Guide/Install.html")).toBe("guide/install.html");
    expect(index.page("notes/idea.html")).toBe("Notes/Idea.html");
    expect(index.page("guide/missing.html")).toBeUndefined();
  });
});
