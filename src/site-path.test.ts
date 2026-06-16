import { describe, expect, it } from "vitest";
import { toSitePath, relativeHref } from "./site-path.js";

describe("toSitePath", () => {
  it("maps a markdown file to .html", () => {
    expect(toSitePath("notes/idea.md")).toBe("notes/idea.html");
  });

  it("is case-insensitive on the .md extension", () => {
    expect(toSitePath("README.MD")).toBe("README.html");
  });

  it("normalizes backslashes to POSIX separators", () => {
    expect(toSitePath("notes\\sub\\idea.md")).toBe("notes/sub/idea.html");
  });

  it("strips a leading slash", () => {
    expect(toSitePath("/notes/idea.md")).toBe("notes/idea.html");
  });

  it("leaves non-markdown asset paths unchanged", () => {
    expect(toSitePath("assets/photo.png")).toBe("assets/photo.png");
  });
});

describe("relativeHref", () => {
  it("links a sibling page by filename", () => {
    expect(relativeHref("notes/idea.html", "notes/plan.html")).toBe("plan.html");
  });

  it("ascends out of nested folders", () => {
    expect(relativeHref("notes/sub/deep.html", "notes/idea.html")).toBe("../idea.html");
  });

  it("descends from root into a folder", () => {
    expect(relativeHref("index.html", "notes/idea.html")).toBe("notes/idea.html");
  });

  it("ascends from a folder to root", () => {
    expect(relativeHref("notes/idea.html", "about.html")).toBe("../about.html");
  });

  it("links a page to itself by filename", () => {
    expect(relativeHref("notes/idea.html", "notes/idea.html")).toBe("idea.html");
  });
});
