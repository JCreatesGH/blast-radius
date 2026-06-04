import { DepGraph } from "./graph.js";

export function toJSON(graph: DepGraph, highlighted: string[] = []): string {
  const set = new Set(highlighted);
  return JSON.stringify({
    nodes: graph.files.map((f) => ({
      id: f, affected: set.has(f), fanIn: graph.importedBy.get(f)?.size ?? 0,
    })),
    edges: graph.files.flatMap((f) =>
      [...(graph.imports.get(f) ?? [])].map((t) => ({ source: f, target: t }))),
  }, null, 2);
}

export function toDot(graph: DepGraph, highlighted: string[] = []): string {
  const set = new Set(highlighted);
  const lines = ["digraph deps {", "  rankdir=LR;", "  node [shape=box,style=rounded];"];
  for (const f of graph.files) {
    if (set.has(f)) lines.push(`  ${JSON.stringify(f)} [style="rounded,filled",fillcolor="#ffd7d5"];`);
  }
  for (const f of graph.files)
    for (const t of graph.imports.get(f) ?? [])
      lines.push(`  ${JSON.stringify(f)} -> ${JSON.stringify(t)};`);
  lines.push("}");
  return lines.join("\n");
}
