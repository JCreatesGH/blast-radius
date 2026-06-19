import { DepGraph } from "./graph.js";

/** All files transitively affected if `changed` files are modified
 * (i.e. everything that imports them, directly or indirectly). */
export function blastRadius(graph: DepGraph, changed: string[]): string[] {
  const affected = new Set<string>();
  const stack = [...changed];
  while (stack.length) {
    const file = stack.pop()!;
    for (const dependent of graph.importedBy.get(file) ?? []) {
      if (!affected.has(dependent)) {
        affected.add(dependent);
        stack.push(dependent);
      }
    }
  }
  return [...affected].sort();
}

// Common test-file conventions: `*.test.ts` / `*.spec.js`, and `__tests__/`, `test/`, `tests/`.
export const DEFAULT_TEST_RE = /(\.(test|spec)\.[cm]?[jt]sx?$)|(^|\/)(__tests__|tests?)\//;

/** Test-impact analysis: the test files that could be affected by `changed` — every
 * test within the blast radius, plus any changed file that is itself a test. Run just
 * these in CI instead of the whole suite. `pattern` overrides what counts as a test. */
export function affectedTests(graph: DepGraph, changed: string[],
                              pattern: RegExp = DEFAULT_TEST_RE): string[] {
  const isTest = (f: string) => pattern.test(f);
  const candidates = new Set<string>(blastRadius(graph, changed));
  for (const c of changed) if (isTest(c)) candidates.add(c);   // a changed test runs too
  return [...candidates].filter(isTest).sort();
}

/** Files that nothing imports — candidate entrypoints or dead code. */
export function roots(graph: DepGraph): string[] {
  return graph.files.filter((f) => (graph.importedBy.get(f)?.size ?? 0) === 0).sort();
}

export interface Hotspot { file: string; impact: number; }

/** Every file ranked by its blast radius — how many other files a change to it
 * would transitively affect. The high-impact files are the architectural hubs to
 * change with care (and to cover well with tests). */
export function hotspots(graph: DepGraph, top?: number): Hotspot[] {
  const ranked: Hotspot[] = graph.files
    .map((file) => ({ file, impact: blastRadius(graph, [file]).length }))
    .sort((a, b) => b.impact - a.impact || a.file.localeCompare(b.file));
  return top != null ? ranked.slice(0, top) : ranked;
}

/** Everything `start` transitively imports (forward closure, excluding `start`). */
export function reachable(graph: DepGraph, start: string[]): string[] {
  const seen = new Set<string>();
  const stack = [...start];
  while (stack.length) {
    const file = stack.pop()!;
    for (const dep of graph.imports.get(file) ?? []) {
      if (!seen.has(dep)) { seen.add(dep); stack.push(dep); }
    }
  }
  return [...seen].sort();
}

/** Files not reachable from any entrypoint — dead code. Entrypoints are always
 * considered live, so an unused but declared entrypoint won't flag itself. */
export function unreachable(graph: DepGraph, entrypoints: string[]): string[] {
  const live = new Set(entrypoints);
  for (const f of reachable(graph, entrypoints)) live.add(f);
  return graph.files.filter((f) => !live.has(f)).sort();
}

/** Simple cycle check via DFS. Returns one cycle path if found. */
export function findCycle(graph: DepGraph): string[] | null {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>(graph.files.map((f) => [f, WHITE]));
  const stack: string[] = [];

  function dfs(node: string): string[] | null {
    color.set(node, GRAY); stack.push(node);
    for (const next of graph.imports.get(node) ?? []) {
      if (color.get(next) === GRAY) return [...stack.slice(stack.indexOf(next)), next];
      if (color.get(next) === WHITE) { const c = dfs(next); if (c) return c; }
    }
    stack.pop(); color.set(node, BLACK);
    return null;
  }
  for (const f of graph.files) if (color.get(f) === WHITE) { const c = dfs(f); if (c) return c; }
  return null;
}
