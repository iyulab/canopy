import { describe, expect, it } from "vitest";
import { build } from "./index.js";

describe("build", () => {
  it("maps each source document to a rendered page", async () => {
    const bundle = await build({
      documents: [
        { path: "index.md", content: "---\ntitle: Home\n---\n# Home" },
        { path: "notes/idea.md", content: "# Idea" },
      ],
    });
    expect(bundle.pages.map((p) => p.sitePath)).toEqual([
      "index.html",
      "notes/idea.html",
    ]);
    expect(bundle.pages[0]?.frontmatter).toEqual({ title: "Home" });
    expect(bundle.pages[0]?.html).toContain('<h1 id="home">Home</h1>');
    expect(bundle.pages[1]?.html).toContain('<h1 id="idea">Idea</h1>');
  });

  it("derives a navigation tree from the rendered pages", async () => {
    const bundle = await build({
      documents: [
        { path: "index.md", content: "---\ntitle: Home\n---\n# Home" },
        { path: "notes/idea.md", content: "# Idea" },
      ],
    });
    expect(bundle.navigation).toEqual([
      { label: "notes", children: [{ label: "idea", sitePath: "notes/idea.html", children: [] }] },
      { label: "Home", sitePath: "index.html", children: [] },
    ]);
  });

  it("resolves wikilinks to relative hrefs and records backlinks", async () => {
    const bundle = await build({
      documents: [
        { path: "notes/idea.md", content: "See [[plan]]." },
        { path: "notes/plan.md", content: "---\ntitle: The Plan\n---\n# Plan" },
      ],
    });
    const idea = bundle.pages.find((p) => p.sitePath === "notes/idea.html");
    const plan = bundle.pages.find((p) => p.sitePath === "notes/plan.html");
    // Sibling link is relative (not root-absolute).
    expect(idea?.html).toContain('href="plan.html"');
    // The plan page is linked from idea -> one backlink, carrying its title.
    expect(plan?.backlinks).toEqual([
      { sitePath: "notes/idea.html", title: undefined },
    ]);
    // idea has no inbound links.
    expect(idea?.backlinks).toEqual([]);
  });

  it("renders an unresolved wikilink as plain text, not a link", async () => {
    const bundle = await build({
      documents: [{ path: "a.md", content: "Link to [[ghost]] here." }],
    });
    expect(bundle.pages[0]?.html).toContain("ghost");
    expect(bundle.pages[0]?.html).not.toContain("<a");
  });

  it("supports alias and heading wikilinks", async () => {
    const bundle = await build({
      documents: [
        { path: "idea.md", content: "[[plan#Next Steps|the plan]]" },
        { path: "plan.md", content: "## Next Steps" },
      ],
    });
    const html = bundle.pages[0]?.html ?? "";
    expect(html).toContain('href="plan.html#next-steps"');
    expect(html).toContain(">the plan</a>");
  });

  it("is deterministic for the same input (stateless build)", async () => {
    const input = { documents: [{ path: "a.md", content: "x [[a]]" }] };
    expect(await build(input)).toEqual(await build(input));
  });
});
