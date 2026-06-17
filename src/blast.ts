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

/** Files that nothing imports — candidate entrypoints or dead code. */
export function roots(graph: DepGraph): string[] {
  return graph.files.filter((f) => (graph.importedBy.get(f)?.size ?? 0) === 0).sort();
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
