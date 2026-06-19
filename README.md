# blast-radius

[![CI](https://github.com/JCreatesGH/blast-radius/actions/workflows/ci.yml/badge.svg)](https://github.com/JCreatesGH/blast-radius/actions)
[![TypeScript](https://img.shields.io/badge/types-included-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Answer the question every reviewer asks: **"what does this change actually affect?"** `blast-radius` builds the import graph of a JS/TS project and computes the transitive set of files impacted by a change — plus **change hotspots** (the files riskiest to touch), dead-code roots, and circular-import detection.

![screenshot](assets/screenshot.png)

## Install

```bash
npm install blast-radius
```

## Use it

```ts
import { buildGraph, blastRadius, affectedTests, hotspots, roots, findCycle, unreachable, toDot } from "blast-radius";

const graph = buildGraph(fileContents);          // { "src/a.ts": "<source>", ... }

blastRadius(graph, ["src/utils/format.ts"]);     // every file that imports it, transitively
affectedTests(graph, ["src/utils/format.ts"]);   // just the test files in that radius (run only these in CI)
hotspots(graph, 10);                             // [{file, impact}] — riskiest files to change, ranked
unreachable(graph, ["src/index.ts"]);            // dead code: files no entrypoint reaches
roots(graph);                                    // files nothing imports (entrypoints / dead code)
findCycle(graph);                                // a circular-import path, or null
toDot(graph, blastRadius(graph, changed));       // Graphviz with affected nodes highlighted
```

## CLI

Installing the package adds a `blast-radius` command that walks a real project (exits 1 on a cycle):

```bash
$ blast-radius src --changed "$(git diff --name-only | paste -sd, -)"
$ blast-radius src --entry src/index.ts          # report dead (unreachable) files
$ blast-radius src --hotspots 10                  # the 10 files riskiest to change
$ blast-radius src --json                        # machine-readable report
```

## How it works

- **Import extraction** handles `import … from`, re-exports (`export … from`), side-effect imports, dynamic `import()`, and `require()` — and ignores commented-out lines and bare (node_modules) specifiers.
- **Resolution** maps relative specifiers to real files across `.ts/.tsx/.js/.jsx/.mjs/.cjs` and `index.*` directory imports.
- **Blast radius** is a reverse-dependency BFS over the graph, so it's exact and fast.
- **Affected tests** — `affectedTests` (and the CLI's `--changed` report) filters the blast radius to the test files (`*.test`/`*.spec`, `__tests__/`, `test(s)/`), so CI can run only the tests a diff could actually break instead of the whole suite. A changed file that is itself a test is included.
- **Hotspots** rank every file by its blast-radius size — the load-bearing modules (a shared util imported everywhere) rise to the top, so you know what to test hardest and review most carefully.
- **Outputs** — `toJSON` (for D3/vis) and `toDot` (for Graphviz), with affected nodes flagged.

Everything works on an in-memory `{path: source}` map, so it's fully unit-tested and trivial to wire to `git diff --name-only`.

## Development

```bash
npm install && npm test    # 17 tests
npm run build              # tsc, clean
```

## License

MIT
