import { describe, expect, it } from "vitest";
import { build } from "./index.js";
import { buildSearchIndex } from "./search-index.js";

describe("buildSearchIndex", () => {
  it("produces one entry per page with its site path, title and headings", async () => {
    const bundle = await build({
      documents: [
        {
          path: "guide/orders.md",
          content: "# Order list\n\n## Filtering\n\nBody text.\n\n## Sorting\n\nMore text.",
        },
      ],
    });
    const index = buildSearchIndex(bundle.pages);
    expect(index).toEqual([
      {
        p: "guide/orders.html",
        t: "Order list",
        h: ["Filtering", "Sorting"],
        b: expect.stringContaining("Body text."),
      },
    ]);
  });

  it("leaves headings empty for a page short enough to have no outline", async () => {
    const bundle = await build({ documents: [{ path: "index.md", content: "# Home\n\nJust one line." }] });
    const [entry] = buildSearchIndex(bundle.pages);
    expect(entry?.h).toEqual([]);
  });

  it("strips markup from the body, leaving plain text rather than HTML", async () => {
    const bundle = await build({
      documents: [{ path: "index.md", content: "# Home\n\nSome **bold** and a [link](https://example.test)." }],
    });
    const [entry] = buildSearchIndex(bundle.pages);
    expect(entry?.b).toContain("Some bold and a link.");
    expect(entry?.b).not.toContain("<");
  });

  it("does not truncate the body, however long the page", async () => {
    // Wave 2's size measurement (cycle-25) already established untruncated
    // bodies stay in the KB range for real sites, so there is no size-driven
    // reason to cut a page's text short here.
    const long = Array.from({ length: 200 }, (_, i) => `Paragraph number ${i}.`).join("\n\n");
    const bundle = await build({ documents: [{ path: "index.md", content: `# Home\n\n${long}` }] });
    const [entry] = buildSearchIndex(bundle.pages);
    expect(entry?.b).toContain("Paragraph number 0.");
    expect(entry?.b).toContain("Paragraph number 199.");
  });

  it("keeps heading text in document order, matching the page's own outline", async () => {
    const bundle = await build({
      documents: [{ path: "index.md", content: "# Home\n\n## Zebra\n\ntext\n\n## Apple\n\ntext" }],
    });
    const [entry] = buildSearchIndex(bundle.pages);
    expect(entry?.h).toEqual(["Zebra", "Apple"]);
  });
});
