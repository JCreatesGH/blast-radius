// Extract module specifiers from JS/TS source (import/export-from/require/dynamic import).
const PATTERNS = [
  /import\s+[^'"]*?from\s*['"]([^'"]+)['"]/g,
  /export\s+[^'"]*?from\s*['"]([^'"]+)['"]/g,
  /import\s*['"]([^'"]+)['"]/g,                 // side-effect import
  /require\(\s*['"]([^'"]+)['"]\s*\)/g,
  /import\(\s*['"]([^'"]+)['"]\s*\)/g,          // dynamic import
];

export function extractImports(source: string): string[] {
  const out = new Set<string>();
  // strip line + block comments cheaply
  const code = source.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const re of PATTERNS) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(code))) out.add(m[1]);
  }
  return [...out];
}

export function isRelative(spec: string): boolean {
  return spec.startsWith("./") || spec.startsWith("../");
}
