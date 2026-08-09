# Scope

Canopy turns a tree of markdown notes into a static website. This document draws the
line around that job: what canopy owns, what it deliberately leaves to its callers, and
how to tell which side a proposed feature falls on.

It exists because canopy is a **shared core**. More than one project builds on it, and
those projects do not know about each other. Without a written boundary, each consumer's
needs would accrete into canopy one reasonable-looking commit at a time, until canopy
served every caller badly and none of them could be changed independently.

---

## The layer canopy owns

**Markdown tree in, deployable static site out.** Everything canopy does serves that
transform:

- **Rendering** — CommonMark + GFM, math, syntax highlighting, callouts, sanitized raw HTML,
  and a fixed extension point (`rehypePlugins` / `--rehype-plugin`) for a caller's own rehype
  plugins, positioned after sanitize and before syntax highlighting
- **Link resolution** — rewriting links between documents to relative hrefs, whether written
  as wikilinks or as ordinary markdown links, and inverting them into a backlink graph
- **Structure** — a site hierarchy, derived from the document paths or supplied by the
  caller, and each page's own heading outline
- **Publishing scope** — which vault paths become part of the site
- **The site shell** — the HTML document wrapped around each page: head metadata,
  stylesheets, sidebar, content, outline, backlinks
- **Theming vocabulary** — a set of semantic CSS custom properties the shell reads. A caller
  layers its own values over canopy's defaults, or restates the whole vocabulary

If a published site is worse *as a site* without it, it probably belongs here.

## What canopy does not do

Each of these is a deliberate non-goal, not a gap awaiting a contribution:

- **Know its callers.** Canopy has no code path, option, or comment that assumes a
  particular consuming application. See *Dependency direction* below.
- **Understand any source app's storage format.** Documents arrive as `{path, content}` —
  no pre-built tree, no app metadata, no hidden config directory. A caller may also supply a
  navigation order, and that is the whole of it: presentation, stated in canopy's own terms,
  never a description of the caller's data.
- **Model a domain.** Concepts belonging to a caller's problem space (products, tenants,
  releases, screens, routes, permissions) never enter canopy's vocabulary, including under
  generic-sounding names.
- **Write to the source.** The vault is read-only. Publishing is one-way and derivative.
- **Author content.** Generating, capturing, checking, or validating source material is the
  caller's job. Canopy renders what it is given.
- **Orchestrate.** Discovering what to build, running several builds, deciding where output
  goes, or deploying it are all outside the transform.
- **Keep state.** The same input yields the same output. No caches, no incremental
  bookkeeping, no build history.
- **Host or serve.** Output is plain files. Anything about serving them is downstream.
- **Author client-side code.** Canopy writes no JavaScript. Behaviour a site could
  get from a script — a theme toggle, a search box, an analytics beacon, a comment
  widget — is never something canopy implements. What CSS can express (colour scheme
  following `prefers-color-scheme`, responsive layout, disclosure widgets, syntax
  colours resolved at build time) is expressed that way; the rest belongs to the
  caller, which owns the output. A caller that needs behaviour supplies its own
  script (`--script`), which canopy carries the same way it carries a caller's
  token stylesheet (`--tokens-css`) — the file is the caller's, and a build given
  none emits none.

## Dependency direction

**Upstream does not know downstream.** Canopy must not reference any consuming project by
name — not in code, not in comments, not in documentation, not in commit messages. Two
consumers of canopy must remain mutually invisible through it.

This is not stylistic. A named consumer in canopy's source is an invitation to reason about
that consumer's needs when changing canopy, which is exactly how a shared core stops being
shared. When a comment needs to describe why an option exists, describe the *situation* it
serves ("a caller that already has its own design tokens"), never the caller.

Referring to an external file-format or directory convention for interoperability is fine
(`.git`, a KaTeX stylesheet); naming a project that consumes canopy is not.

---

## Is this request in scope?

Work through these in order. The first one that answers settles it.

**1. Does it serve the transform?**
Would a published site be worse *as a site* without it? If the value only appears in a
particular caller's workflow, it belongs to that caller.

**2. Does it stay inside the input contract?**
Can it be expressed in terms of markdown, frontmatter, and paths? A feature needing a new
kind of input from callers deserves scrutiny — sometimes the answer is a new generic
option, more often the work belongs upstream of canopy.

**3. Is it stated in canopy's own vocabulary?**
Write the feature down without naming any consumer or its domain. If that cannot be done —
if the description needs "for X" to make sense — it is that caller's concern.
Generic-sounding names do not launder a domain concept: a field is domain-specific because
of what it *means*, not what it is called.

**4. Would a second, unrelated caller want it?**
Not "could it be justified?" but "does the need arise naturally for someone else?" Answer
this honestly; the tempting failure is to invent a hypothetical second caller.

**5. Does the renderer's own completeness require it?**
This is the strongest reason to accept a feature and the easiest to confuse with the
weakest. The test is whether the *renderer* is incomplete without it — a capability sites
generally need and canopy structurally cannot express — not whether some caller currently
wants it.

Because it is the argument that can override a "no" from question 4, it needs a check of
its own. Write the claim as a sentence with no consumer in it:

> "A renderer that cannot express *X* is an incomplete renderer."

Then look for these, each of which means the claim has not been earned:

- **The sentence needs a purpose clause to stand.** "…is incomplete *for publishing product
  documentation*" is question 4 in disguise.
- **Canopy has not already claimed that responsibility.** The strongest form of this
  argument points at something canopy says it does and does only partway — it derives
  navigation but can express one ordering; it parses headings and assigns them ids but
  never shows them. A capability canopy never claimed is a new responsibility, not a
  completed one.
- **No user is currently damaging their output to work around it.** When the only way to
  express something is to encode it in filenames or post-process the HTML, the missing
  expression is the renderer's gap. When there is no workaround because nobody needed it,
  that is speculative generality.

A feature that passes question 5 on a real reading is worth accepting even with one known
caller. A feature that only passes on a strained reading is question 4 wearing a better
argument — and admitting it under this heading is how the boundary quietly moves.

**6. Does it preserve statelessness and read-only?**
Anything caching between builds, mutating the vault, or making output depend on prior runs
is out regardless of how it scored above.

### When the answer is no

Out-of-scope is not the same as unimportant. A request that fails these tests is usually a
real need sitting one layer up — the caller can compose it around canopy, which keeps both
layers replaceable. Say which layer it belongs to rather than only declining.

### When the answer is genuinely unclear

Prefer the narrower reading. A capability withheld can be added once a second caller shows
the same need; a capability released becomes a contract that constrains every future
change. Growth driven by demonstrated demand is the intended path — speculative generality
is not.
