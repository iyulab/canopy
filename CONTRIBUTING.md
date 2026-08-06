# Contributing

Thanks for your interest in canopy. This document covers how to work on it and, just as
importantly, how to tell whether a change belongs in it at all.

## Before proposing a feature: read the scope

Canopy is a **shared core** — more than one project builds on it, and those projects do not
know about each other. That makes the boundary around canopy load-bearing: a feature that
serves one caller well can make canopy worse for every other caller.

**[docs/SCOPE.md](docs/SCOPE.md) is the gate.** It states what canopy owns, what it
deliberately does not do, and a numbered test for deciding which side a request falls on.
Please work through that test before opening an issue or a pull request, and include the
reasoning in your proposal — the specific question that settled it, and why.

Two rules from that document come up often enough to repeat here:

- **Canopy does not know its callers.** No consuming project may be named in code,
  comments, documentation, or commit messages. Describe the *situation* an option serves,
  never the project that has it.
- **A capability is not justified by one caller wanting it.** It is justified by the
  renderer being incomplete without it, or by a need that arises naturally for unrelated
  callers. When it is unclear, the narrower reading wins — withheld capability can be added
  later, released capability is a contract.

If a request falls outside the scope, that is not a verdict on its value. It usually means
the need sits one layer up, where a caller can compose it around canopy.

## Development

```sh
npm install
npm run check   # type-check (tsc)
npm run lint    # Biome
npm test        # vitest
npm run build   # emit dist/
```

All four should pass before you open a pull request.

## Conventions

- **Language** — everything in this repository is written in English: code, comments, error
  messages, documentation, and commit messages.
- **Tests** — behavior changes come with tests. The parity golden files
  (`src/math-parity.golden.json`, `src/callout-parity.golden.json`) pin tokenization that
  downstream editors mirror byte-for-byte; changing one is a deliberate, documented move,
  not a side effect.
- **Determinism** — the build is stateless: the same input must always yield the same
  output. A change that introduces caching, ordering instability, or dependence on prior
  runs breaks a guarantee callers rely on.
- **Read-only source** — canopy never writes into the vault it reads.
- **Changelog** — user-visible changes get an entry in [CHANGELOG.md](CHANGELOG.md) under
  `## [Unreleased]`, phrased in canopy's own terms.

## Reporting bugs

A reproduction beats a description: the smallest markdown input that shows the problem, the
command you ran, what you expected, and what you got. For rendering issues, the emitted HTML
is more useful than a screenshot.
