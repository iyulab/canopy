import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "./frontmatter.js";

describe("parseFrontmatter", () => {
  it("splits leading YAML frontmatter from the body", () => {
    const { data, body } = parseFrontmatter(
      "---\ntitle: Hello\ntags:\n  - a\n  - b\n---\n# Body\n",
    );
    expect(data).toEqual({ title: "Hello", tags: ["a", "b"] });
    expect(body).toBe("# Body\n");
  });

  it("returns empty data and untouched body when there is no frontmatter", () => {
    const raw = "# Just a heading\n\nText.";
    expect(parseFrontmatter(raw)).toEqual({ data: {}, body: raw });
  });

  it("does not treat a thematic break further down as frontmatter", () => {
    const raw = "# Heading\n\n---\n\nmore";
    expect(parseFrontmatter(raw).data).toEqual({});
    expect(parseFrontmatter(raw).body).toBe(raw);
  });

  it("handles an empty frontmatter block", () => {
    const { data, body } = parseFrontmatter("---\n---\n# Body");
    expect(data).toEqual({});
    expect(body).toBe("# Body");
  });

  it("ignores non-object YAML (a bare scalar)", () => {
    const { data } = parseFrontmatter("---\njust a string\n---\nbody");
    expect(data).toEqual({});
  });
});
