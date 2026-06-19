# Changelog

All notable changes are documented here, following
[Keep a Changelog](https://keepachangelog.com/) and [SemVer](https://semver.org/).

## [0.3.0]

### Added
- **Affected-test selection (TIA)** — `affectedTests(graph, changed, pattern?)` returns the test
  files within a change's blast radius (`*.test`/`*.spec`, `__tests__/`, `test(s)/`), plus any
  changed file that is itself a test — so CI runs only the tests a diff could break. The CLI's
  `--changed` report and JSON now include `affectedTests`. Exported `DEFAULT_TEST_RE` for overrides.

## [0.2.0]

### Added
- **Change hotspots** — `hotspots(graph, top?)` ranks every file by its blast-radius
  size (how many files a change to it would transitively affect), surfacing the
  architectural hubs that are riskiest to touch and most worth testing. Included
  in `analyze()`'s report, the CLI's text output, and `--json`; tune the count
  with the `--hotspots N` flag.

## [0.1.0]

### Added
- Build a JS/TS import graph and compute the transitive **blast radius** of a
  change, plus dead-code detection (`unreachable`), roots, circular-import
  detection (`findCycle`), JSON/DOT rendering, and a `blast-radius` CLI.
