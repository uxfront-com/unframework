// A stubbed compile, since a file past the source-map diff's bound ships without a map, which no
// real input does yet. It also gives the warning `strict` turns into an error, a file that doesn't
// end in a newline, and the order of the compiles. The glob is reversed, as a file system may give
// it (P8). The tsgo oracle can't load, so a command that doesn't choose it shows it stays unloaded.
import { readFileSync } from "node:fs";
import type * as FsPromises from "node:fs/promises";
import { join } from "node:path";

import type * as Compiler from "@unframework/compiler";
import type { Project } from "@unframework/compiler";
import { describe, expect, it, vi } from "vitest";

import { project, run, tree } from "./helpers.ts";

const compiles = vi.hoisted((): string[] => []);
const projects = vi.hoisted((): unknown[] => []);
const disposals = vi.hoisted(() => ({ count: 0 }));

vi.mock("node:fs/promises", async (original) => {
  const actual = await original<typeof FsPromises>();
  return {
    ...actual,
    glob: async function* (...args: Parameters<typeof actual.glob>) {
      const entries = [];
      for await (const entry of actual.glob(...args)) entries.push(entry);
      yield* entries.toReversed();
    },
  };
});

vi.mock("@unframework/type-oracle-tsgo", () => {
  throw new Error("the tsgo oracle was loaded");
});

const WARNING = {
  code: "UF4001",
  severity: "warning",
  message: "A portability warning.",
  file: "src/A.uf.tsx",
  span: { start: 0, end: 0 },
};

vi.mock("@unframework/compiler", async (original) => {
  const actual = await original<typeof Compiler>();
  return {
    ...actual,
    createSyntacticOracle: (options: Parameters<typeof actual.createSyntacticOracle>[0]) => {
      const oracle = actual.createSyntacticOracle(options);
      return {
        ...oracle,
        dispose: async () => {
          disposals.count += 1;
          await oracle.dispose();
        },
      };
    },
    createProject: (options: unknown): Partial<Project> => {
      projects.push(options);
      return {
        compile: async (file: string) => {
          compiles.push(file);
          if (file === "src/setup-warning.uf.tsx") {
            return {
              filename: file,
              ir: undefined,
              diagnostics: [{ ...WARNING, code: "UF2007", file }],
              outputs: { react: [{ path: "S.tsx", contents: "export default 4;\n" }] },
              owners: { react: {} },
              dependencies: [],
            } as never;
          }
          if (file === "src/copy-clash.uf.tsx" || file === "src/copy-case.uf.tsx") {
            return {
              filename: file,
              ir: undefined,
              diagnostics: [],
              outputs: {
                react:
                  file === "src/copy-clash.uf.tsx"
                    ? [{ path: "C.ts", contents: "export const shared = 1;\n" }]
                    : [],
              },
              owners: { react: {} },
              dependencies: [],
            } as never;
          }
          if (file === "src/case.uf.tsx") {
            const same = { contents: "export default 3;\n" };
            return {
              filename: file,
              ir: undefined,
              diagnostics: [],
              outputs: {
                react: [
                  { path: "a.tsx", ...same },
                  { path: "A.tsx", ...same },
                ],
              },
              owners: { react: {} },
              dependencies: [],
            } as never;
          }
          return {
            filename: "src/A.uf.tsx",
            ir: undefined,
            diagnostics: [WARNING],
            outputs: {
              react: [
                { path: "A.tsx", contents: "export default null;\n" },
                {
                  path: "B.tsx",
                  contents: "export default 1;\n",
                  map: { version: 3, sources: ["A.uf.tsx"], names: [], mappings: "" },
                },
                {
                  path: "C.tsx",
                  contents: "export default 2;",
                  map: { version: 3, sources: ["A.uf.tsx"], names: [], mappings: "" },
                },
              ],
            },
            owners: { react: {} },
            dependencies: [],
          } as never;
        },
        copies: (file: string) => {
          const contents = "export const shared = 1;\n";
          if (file === "src/copy-clash.uf.tsx") return [{ path: "C.ts", contents }];
          if (file === "src/copy-case.uf.tsx") {
            return [
              { path: "d.ts", contents },
              { path: "D.ts", contents },
            ];
          }
          return [];
        },
        dependencies: () => [],
      };
    },
  };
});

const CONFIG = 'export default { targets: ["react"] };\n';
const STRICT = 'export default { targets: ["react"], strict: true };\n';
const SOURCE = { "src/A.uf.tsx": "export default function A() {}\n" };

describe("an output with no map", () => {
  it("writes no sidecar and no comment, while a mapped one beside it does", async () => {
    const root = project({ ...SOURCE, "unframework.config.mjs": CONFIG });
    expect(await run(root, "build")).toMatchObject({ code: 0 });
    const files = tree(join(root, "dist/react"));
    expect(readFileSync(join(root, "dist/react/A.tsx"), "utf8")).toBe("export default null;\n");
    expect(files["A.tsx.map"]).toBeUndefined();
    expect(files["B.tsx"]).toContain("//# sourceMappingURL=B.tsx.map");
    expect(files["B.tsx.map"]).toBeDefined();
  });

  it("puts the comment on a line of its own in a file with no final newline", async () => {
    const root = project({ ...SOURCE, "unframework.config.mjs": CONFIG });
    await run(root, "build");
    expect(tree(join(root, "dist/react"))["C.tsx"]).toBe(
      "export default 2;\n//# sourceMappingURL=C.tsx.map\n",
    );
  });
});

describe("two files of one text whose paths differ only in case", () => {
  it("is UF1104, since the second would never be written", async () => {
    const root = project({ "src/case.uf.tsx": "", "unframework.config.mjs": CONFIG });
    const { code, stderr } = await run(root, "build");
    expect(code).toBe(1);
    expect(stderr).toContain("would both write A.tsx");
  });
});

describe("a shared module's copy", () => {
  it.each([
    ["a module's output of its text", "src/copy-clash.uf.tsx", "would both write C.ts"],
    [
      "another copy whose path differs only in case",
      "src/copy-case.uf.tsx",
      "would both write D.ts",
    ],
  ])("is UF1104 beside %s", async (_name, source, message) => {
    const root = project({ [source]: "", "unframework.config.mjs": CONFIG });
    const { code, stderr } = await run(root, "build");
    expect(code).toBe(1);
    expect(stderr).toContain(message);
  });
});

describe("what a project is given", () => {
  it("holds the config's target options and source maps, and its oracle is disposed of", async () => {
    const root = project({
      ...SOURCE,
      "unframework.config.mjs":
        'export default { targets: ["react"], targetOptions: { react: { compiler: true } } };\n',
    });
    projects.length = 0;
    disposals.count = 0;
    await run(root, "check");
    expect(projects).toEqual([
      expect.objectContaining({
        targets: ["react"],
        targetOptions: { react: { compiler: true } },
        sourceMap: true,
      }),
    ]);
    expect(disposals.count).toBe(1);
  });
});

describe("the order of the sources", () => {
  it("is sorted, whatever order the file system gives", async () => {
    const root = project({
      ...SOURCE,
      "src/b.uf.tsx": "",
      "src/a/z.uf.ts": "",
      "unframework.config.mjs": CONFIG,
    });
    compiles.length = 0;
    await run(root, "check");
    expect(compiles).toEqual(["src/A.uf.tsx", "src/a/z.uf.ts", "src/b.uf.tsx"]);
  });
});

describe("strict", () => {
  it("leaves a portability warning a warning by default", async () => {
    const root = project({ ...SOURCE, "unframework.config.mjs": CONFIG });
    const { code, stderr } = await run(root, "build");
    expect(code).toBe(0);
    expect(stderr).toContain("warning[UF4001]");
  });

  it("makes it an error", async () => {
    const root = project({ ...SOURCE, "unframework.config.mjs": STRICT });
    const { code, stderr, stdout } = await run(root, "build");
    expect({ code, stdout }).toEqual({ code: 1, stdout: "" });
    expect(stderr).toContain("error[UF4001]");
    const check = await run(root, "check", "--format", "json");
    expect(check.code).toBe(1);
    expect(JSON.parse(check.stdout)[0]).toMatchObject({ code: "UF4001", severity: "error" });
  });

  it("leaves any other warning a warning", async () => {
    const root = project({ "src/setup-warning.uf.tsx": "", "unframework.config.mjs": STRICT });
    const { code, stderr } = await run(root, "build");
    expect(code).toBe(0);
    expect(stderr).toContain("warning[UF2007]");
  });
});

describe("the tsgo oracle", () => {
  const TSGO = 'export default { targets: ["react"], typeOracle: "tsgo" };\n';

  it("isn't loaded by default", async () => {
    const root = project({ ...SOURCE, "unframework.config.mjs": CONFIG });
    expect(await run(root, "check")).toMatchObject({ code: 0 });
    expect(await run(root, "check", "--type-oracle", "syntactic")).toMatchObject({ code: 0 });
  });

  // Vitest reports the factory's throw as this error, whatever its message.
  it("is loaded when the flag or the config chooses it", async () => {
    const flag = project({ ...SOURCE, "unframework.config.mjs": CONFIG });
    const chosen = await run(flag, "check", "--type-oracle", "tsgo");
    expect(chosen.code).toBe(2);
    expect(chosen.stderr).toContain("error when mocking a module");
    const config = project({ ...SOURCE, "unframework.config.mjs": TSGO });
    const configured = await run(config, "check");
    expect(configured.code).toBe(2);
    expect(configured.stderr).toContain("error when mocking a module");
  });

  it("gives way to --type-oracle syntactic", async () => {
    const root = project({ ...SOURCE, "unframework.config.mjs": TSGO });
    expect(await run(root, "check", "--type-oracle", "syntactic")).toMatchObject({ code: 0 });
  });
});
