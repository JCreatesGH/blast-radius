import { describe, it, expect } from "vitest";
import { buildGraph } from "./graph";
import { blastRadius, roots, findCycle } from "./blast";
import { extractImports } from "./imports";

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
