import type { HarnessContext } from "@unframework/testing/node";
import { describe, expect, inject, it } from "vitest";
import type { UserWorkspaceConfig } from "vitest/config";

import {
  harnessProjects,
  isSelected,
  projectNames,
  projectPatterns,
  projectTest,
} from "./projects.ts";
import { selectTargets } from "./targets.ts";

const harness: HarnessContext = inject("ufHarness");
const mode = { update: false, pixels: "baseline", canary: null, ci: false } as const;

describe("selectTargets", () => {
  it("selects every target by default, in the documented order", () => {
    expect(selectTargets(undefined)).toEqual([
      "react",
      "vue",
      "svelte",
      "solid",
      "angular",
      "qwik",
      "astro",
    ]);
    expect(selectTargets(" ")).toHaveLength(7);
  });

  it("restricts the run to UF_TARGETS, in the documented order", () => {
    expect(selectTargets("vue, react")).toEqual(["react", "vue"]);
  });

  it("refuses unknown targets", () => {
    expect(() => selectTargets("vue,lit")).toThrow(/unknown target\(s\): lit/);
  });
});

describe("projects", () => {
  it("names one compile and one harness project, and three projects per target", () => {
    expect(projectNames(["react", "vue"])).toEqual([
      "compile",
      "harness",
      "toolchain:react",
      "toolchain:vue",
      "ssr:react",
      "ssr:vue",
      "browser:react",
      "browser:vue",
    ]);
  });

  it("reads --project patterns from a command line, in every spelling Vitest accepts", () => {
    expect(
      projectPatterns([
        "vitest",
        "run",
        "--project",
        "ssr:*",
        "--project=compile",
        "-p",
        "browser:vue",
        "-p=toolchain:*",
        "--passWithNoTests",
      ]),
    ).toEqual(["ssr:*", "compile", "browser:vue", "toolchain:*"]);
  });

  it("selects projects as Vitest does: wildcards, negations, any letter case", () => {
    expect(isSelected("ssr:vue", undefined)).toBe(true);
    expect(isSelected("ssr:vue", ["ssr:*"])).toBe(true);
    expect(isSelected("browser:vue", ["ssr:*"])).toBe(false);
    expect(isSelected("browser:vue", ["!browser:react"])).toBe(true);
    expect(isSelected("browser:react", ["browser:*", "!browser:react"])).toBe(false);
    expect(isSelected("browser:vue", ["Browser:Vue"])).toBe(true);
    expect(isSelected("browser:react", ["!BROWSER:*"])).toBe(false);
    expect(isSelected("ssr:vue", ["ssr.vue"])).toBe(false);
  });
});

describe("projectTest", () => {
  const owned = {
    name: "browser:vue",
    include: ["cases/**/*.test.ts"],
    setupFiles: ["/setup.ts"],
  };

  it("keeps the toolchain's own options over the harness's defaults", () => {
    const test = projectTest(
      "vue",
      { pool: "threads", setupFiles: "/framework.ts", server: { deps: { inline: ["vue"] } } },
      { pool: "forks", testTimeout: 60_000 },
      owned,
    );
    expect(test).toEqual({
      ...owned,
      pool: "threads",
      testTimeout: 60_000,
      server: { deps: { inline: ["vue"] } },
      // The harness's setup (determinism, the console capture) runs first.
      setupFiles: ["/setup.ts", "/framework.ts"],
    });
  });

  it("refuses a toolchain option that the harness owns, rather than dropping it", () => {
    expect(() => projectTest("vue", { include: ["src/**"], name: "mine" }, {}, owned)).toThrow(
      "The vue toolchain's Vite configuration sets test.include, test.name, which the harness owns in its projects.",
    );
  });
});

describe("project factories", () => {
  it("turn a project whose toolchain cannot load into one that fails every case, with the reason", async () => {
    const [, , , ssr, browser] = harnessProjects({ harness, mode, targets: ["missing"] });
    for (const [factory, layers] of [
      [ssr, ["L6", "L13"]],
      [browser, ["L7", "L10", "L11", "L13"]],
    ] as const) {
      const project = await (factory as () => Promise<UserWorkspaceConfig>)();
      expect(project.test?.include).toEqual(["harness/unavailable.test.ts"]);
      const provided = project.test?.provide as
        | { ufUnavailable: { layers: string[]; message: string } }
        | undefined;
      const unavailable = provided?.ufUnavailable;
      if (!unavailable) throw new Error("The project provides no ufUnavailable.");
      expect(unavailable.layers).toEqual(layers);
      expect(unavailable.message).toMatch(
        /^The missing toolchain \(@unframework\/target-missing\/toolchain\) could not be loaded\.\ncaused by: /,
      );
    }
  });

  it("load no toolchain for a project that --project does not select", async () => {
    const [, , , ssr] = harnessProjects({
      harness,
      mode,
      targets: ["missing"],
      projectFilter: ["compile"],
    });
    const project = await (ssr as () => Promise<UserWorkspaceConfig>)();
    expect(project.test).toMatchObject({ name: "ssr:missing", include: [] });
  });
});
