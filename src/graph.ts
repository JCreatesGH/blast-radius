import { extractImports, isRelative } from "./imports.js";
import { resolveImport } from "./resolve.js";

export interface DepGraph {
  files: string[];
  imports: Map<string, Set<string>>;     // file -> files it imports
  importedBy: Map<string, Set<string>>;  // file -> files that import it
}

export function buildGraph(fileContents: Record<string, string>): DepGraph {
  const files = Object.keys(fileContents);
  const fileSet = new Set(files);
  const imports = new Map<string, Set<string>>();
  const importedBy = new Map<string, Set<string>>();
  for (const f of files) { imports.set(f, new Set()); importedBy.set(f, new Set()); }

  for (const f of files) {
    for (const spec of extractImports(fileContents[f])) {
      if (!isRelative(spec)) continue;          // ignore node_modules
      const target = resolveImport(f, spec, fileSet);
      if (target && target !== f) {
        imports.get(f)!.add(target);
        importedBy.get(target)!.add(f);
      }
    }
  }
  return { files, imports, importedBy };
}
