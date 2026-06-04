// Resolve a relative import specifier to a known file path in the project.
const EXT = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

function normalize(path: string): string {
  const parts: string[] = [];
  for (const seg of path.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

export function resolveImport(fromFile: string, spec: string, files: Set<string>): string | null {
  const baseDir = fromFile.includes("/") ? fromFile.slice(0, fromFile.lastIndexOf("/")) : "";
  const joined = normalize((baseDir ? baseDir + "/" : "") + spec);
  for (const ext of EXT) {
    const cand = joined + ext;
    if (files.has(cand)) return cand;
  }
  for (const idx of ["/index.ts", "/index.tsx", "/index.js", "/index.jsx"]) {
    if (files.has(joined + idx)) return joined + idx;
  }
  return null;
}
