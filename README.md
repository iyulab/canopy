# Canopy

> Your markdown tree, blooming into a static site on the web.

**Canopy** is a publishing renderer that turns a tree of markdown notes into a static website.
It maps your folder structure into navigation, wikilinks into hyperlinks, and frontmatter into metadata,
producing a **deployable site bundle in a single build**.

Just as a tree's canopy is the layer seen from the outside, Canopy renders the **public face** of your note tree.

---

## What it does

- **Input** — markdown + frontmatter + folder tree
- **Output** — a static site bundle (HTML · assets · navigation · backlink graph · site shell)
- **Stateless build** — the same input always yields the same output

## Design principles

- **App-agnostic.** It knows nothing about any specific note app's internal format or hidden config directory.
  It only accepts the generic contract "markdown + frontmatter + tree", so any tool that wants publishing can use it.
- **Read-only, one-way.** The source is the user's local files; the published output is a derivative. Canopy never touches the source.
- **Self-hostable.** Being open source (MIT), you can render it yourself and deploy anywhere (GitHub Pages, Cloudflare Pages, etc.).

## Where it's used

- The "publish to web" feature of a local note app
- A markdown vault → documentation site
- Anywhere you want to bake a set of frontmatter-bearing markdown files into a site

## License

MIT

---

*Canopy — the public face of your notes.*
