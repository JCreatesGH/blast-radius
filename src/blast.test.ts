import { describe, it, expect } from "vitest";
import { buildGraph } from "./graph";
import { blastRadius, roots, findCycle, reachable, unreachable, hotspots } from "./blast";
import { extractImports } from "./imports";
import { analyze } from "./cli";

const project = {
  "src/utils/format.ts": `export const f = 1;`,
  "src/models/user.ts": `import { f } from "../utils/format";`,
  "src/api/users.ts": `import { User } from "../models/user";\nexport {};`,
  "src/api/index.ts": `export * from "./users";`,
  "src/app.ts": `import "./api";\nconst x = require("lodash");`,
};

describe("extractImports", () => {
  it("finds static, re-export, side-effect, dynamic and require", () => {
    const src = `import a from "x";\nexport * from "y";\nimport "z";\nconst l = require("q");\nimport("d");`;
    expect(extractImports(src).sort()).toEqual(["d", "q", "x", "y", "z"]);
  });
  it("ignores commented-out imports", () => {
    expect(extractImports(`// import x from "nope";\nimport y from "real";`)).toEqual(["real"]);
  });
});

describe("buildGraph + blastRadius", () => {
  const g = buildGraph(project);

  it("resolves relative imports across extensions and index files", () => {
    expect([...g.imports.get("src/models/user.ts")!]).toEqual(["src/utils/format.ts"]);
    expect([...g.imports.get("src/app.ts")!]).toEqual(["src/api/index.ts"]); // ./api -> index
  });

  it("maps a TS-ESM '.js' specifier to its '.ts' source", () => {
    const esm = buildGraph({
      "src/index.ts": `export { a } from "./mod.js";`,   // .js in source, .ts on disk
      "src/mod.ts": `export const a = 1;`,
    });
    expect([...esm.imports.get("src/index.ts")!]).toEqual(["src/mod.ts"]);
  });

  it("computes transitive blast radius of a change", () => {
    // touching format.ts affects everything up the chain
    expect(blastRadius(g, ["src/utils/format.ts"])).toEqual([
      "src/api/index.ts", "src/api/users.ts", "src/app.ts", "src/models/user.ts",
    ]);
  });

  it("a leaf entrypoint affects nothing", () => {
    expect(blastRadius(g, ["src/app.ts"])).toEqual([]);
  });

  it("roots are files nothing imports", () => {
    expect(roots(g)).toEqual(["src/app.ts"]);
  });
});

describe("reachable + unreachable (dead code)", () => {
  // app -> api/index -> api/users -> models/user -> utils/format. orphan is dead.
  const withDead = buildGraph({ ...project, "src/orphan.ts": `export const z = 0;` });

  it("reachable is the forward transitive closure of imports", () => {
    expect(reachable(withDead, ["src/app.ts"])).toEqual([
      "src/api/index.ts", "src/api/users.ts", "src/models/user.ts", "src/utils/format.ts",
    ]);
  });

  it("flags files unreachable from the entrypoint as dead code", () => {
    expect(unreachable(withDead, ["src/app.ts"])).toEqual(["src/orphan.ts"]);
    // with no dead files, nothing is reported
    expect(unreachable(buildGraph(project), ["src/app.ts"])).toEqual([]);
  });
});

describe("hotspots", () => {
  const g = buildGraph(project);

  it("ranks files by how much changing them would affect", () => {
    const hs = hotspots(g);
    // format.ts is imported (transitively) by everything -> highest impact
    expect(hs[0].file).toBe("src/utils/format.ts");
    expect(hs[0].impact).toBe(4);                 // models/user, api/users, api/index, app
    // the root entrypoint affects nothing
    expect(hs.find((h) => h.file === "src/app.ts")!.impact).toBe(0);
  });

  it("honors the top-N cap", () => {
    expect(hotspots(g, 2)).toHaveLength(2);
  });
});

describe("analyze", () => {
  it("bundles file count, roots, cycle, hotspots, blast radius, and dead code", () => {
    const r = analyze({ ...project, "src/orphan.ts": `export const z = 0;` },
      { changed: ["src/utils/format.ts"], entry: ["src/app.ts"] });
    expect(r.files).toBe(6);
    expect(r.roots).toContain("src/app.ts");
    expect(r.cycle).toBeNull();
    expect(r.hotspots[0].file).toBe("src/utils/format.ts");
    expect(r.blastRadius).toContain("src/models/user.ts");
    expect(r.deadCode).toEqual(["src/orphan.ts"]);
  });
});

describe("findCycle", () => {
  it("detects a circular import", () => {
    const cyclic = buildGraph({
      "a.ts": `import "./b";`,
      "b.ts": `import "./a";`,
    });
    const cycle = findCycle(cyclic);
    expect(cycle).not.toBeNull();
    expect(cycle!.length).toBeGreaterThanOrEqual(2);
  });
  it("returns null for an acyclic graph", () => {
    expect(findCycle(buildGraph(project))).toBeNull();
  });
});
