#!/usr/bin/env node
import { buildGraph } from "./graph.js";
import { blastRadius, affectedTests, roots, findCycle, unreachable, hotspots, Hotspot } from "./blast.js";

const HELP = `blast-radius — import-graph impact analysis for a JS/TS project

Usage:
  blast-radius <dir> [--changed a.ts,b.ts] [--entry src/index.ts] [--hotspots N] [--json]

  --changed    files that changed → report everything they transitively affect (and the tests to run)
  --entry      entrypoint(s) → report unreachable (dead) files
  --hotspots N show the N most impactful files to change (default 10)
  --json       machine-readable output`;

const EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const IGNORE_DIRS = new Set(["node_modules", "dist", "build", ".git", ".next", "coverage"]);

export interface Report {
  files: number;
  roots: string[];
  cycle: string[] | null;
  hotspots: Hotspot[];
  blastRadius?: string[];
  affectedTests?: string[];
  deadCode?: string[];
}

/** Pure analysis over an in-memory {path: source} map. */
export function analyze(
  fileContents: Record<string, string>,
  opts: { changed?: string[]; entry?: string[]; hotspots?: number } = {},
): Report {
  const graph = buildGraph(fileContents);
  const report: Report = {
    files: graph.files.length,
    roots: roots(graph),
    cycle: findCycle(graph),
    hotspots: hotspots(graph, opts.hotspots ?? 10),
  };
  if (opts.changed && opts.changed.length) {
    report.blastRadius = blastRadius(graph, opts.changed);
    report.affectedTests = affectedTests(graph, opts.changed);
  }
  if (opts.entry && opts.entry.length) report.deadCode = unreachable(graph, opts.entry);
  return report;
}

function csv(args: string[], flag: string): string[] {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1].split(",").map((s) => s.trim()).filter(Boolean) : [];
}

function format(r: Report): string {
  const lines = [`${r.files} files analyzed`, `roots (unimported): ${r.roots.length}`];
  for (const f of r.roots) lines.push(`  • ${f}`);
  lines.push(r.cycle ? `circular import: ${r.cycle.join(" → ")}` : "no circular imports");
  const hot = r.hotspots.filter((h) => h.impact > 0);
  if (hot.length) {
    lines.push(`\nhotspots (most impactful to change):`);
    for (const h of hot) lines.push(`  • ${h.file} → ${h.impact} affected`);
  }
  if (r.blastRadius) {
    lines.push(`\nblast radius (${r.blastRadius.length} affected):`);
    for (const f of r.blastRadius) lines.push(`  • ${f}`);
  }
  if (r.affectedTests) {
    lines.push(`\naffected tests (${r.affectedTests.length} to run):`);
    for (const f of r.affectedTests) lines.push(`  • ${f}`);
  }
  if (r.deadCode) {
    lines.push(`\ndead code (${r.deadCode.length} unreachable):`);
    for (const f of r.deadCode) lines.push(`  • ${f}`);
  }
  return lines.join("\n");
}

// Execute only as the CLI binary (not when imported by tests).
if (process.argv[1] && /cli\.js$/.test(process.argv[1])) {
  const args = process.argv.slice(2);
  if (!args.length || args.includes("-h") || args.includes("--help")) {
    console.log(HELP);
    process.exit(args.length ? 0 : 1);
  }
  const dir = args.find((a) => !a.startsWith("-"))!;
  Promise.all([import("node:fs"), import("node:path")]).then(([fs, path]) => {
    const contents: Record<string, string> = {};
    const walk = (d: string) => {
      for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
        if (ent.name.startsWith(".") && ent.name !== ".") continue;
        const full = path.join(d, ent.name);
        if (ent.isDirectory()) { if (!IGNORE_DIRS.has(ent.name)) walk(full); }
        else if (EXTS.includes(path.extname(ent.name))) {
          // Key relative to cwd so paths line up with `git diff --name-only` for --changed/--entry.
          const rel = path.relative(process.cwd(), full).split(path.sep).join("/");
          contents[rel] = fs.readFileSync(full, "utf8");
        }
      }
    };
    walk(dir);
    const hsIdx = args.indexOf("--hotspots");
    const hsN = hsIdx >= 0 ? (parseInt(args[hsIdx + 1], 10) || 10) : undefined;
    const report = analyze(contents, {
      changed: csv(args, "--changed"), entry: csv(args, "--entry"), hotspots: hsN,
    });
    console.log(args.includes("--json") ? JSON.stringify(report, null, 2) : format(report));
    process.exit(report.cycle ? 1 : 0);
  });
}
