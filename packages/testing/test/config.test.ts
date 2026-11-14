// defineTestConfig and its case discovery (ADR-0086), on throwaway projects outside the
// repository: the projects a configuration's targets give, the reference that always joins a run,
// and the layouts a case may take.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { Plugin, ViteDevServer } from "vite";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import type { TestProjectInlineConfiguration } from "vitest/config";

import { parseTestArguments, run } from "../src/cli.ts";
import { NO_ERROR_BROADCAST, noErrorBroadcast } from "../src/config/broadcast.ts";
import { discoverCases } from "../src/config/cases.ts";
import {
  defineTestConfig,
  runTargets,
  selectedTargets,
  TARGET_PACKAGES,
  TESTING_PACKAGE,
  toolchainDirOf,
} from "../src/config/index.ts";

const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** A throwaway project holding `files`, by path relative to its root. */
function project(files: Record<string, string>): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "uf-test-config-")));
  roots.push(root);
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), contents);
  }
  return root;
}

const COMPONENT = "export default function Badge() {\n  return <b>New</b>;\n}\n";
const SPEC = 'import { it } from "@unframework.dev/testing";\n';

/** The variables these tests set, restored after each. */
const SAVED = ["UF_TARGETS", "UF_UPDATE", "CI"] as const;
const env = Object.fromEntries(SAVED.map((name) => [name, process.env[name]]));
afterEach(() => {
  for (const name of SAVED) {
    if (env[name] === undefined) delete process.env[name];
    else process.env[name] = env[name];
  }
});

/** A configuration's projects, in order. */
async function projectsOf(
  options: Parameters<typeof defineTestConfig>[0],
): Promise<TestProjectInlineConfiguration[]> {
  const projects = (await defineTestConfig(options)).test?.projects;
  if (!projects) throw new Error("defineTestConfig gave no projects.");
  return projects as TestProjectInlineConfiguration[];
}

/** The names of a configuration's projects, in order. */
async function projectNames(root: string): Promise<string[]> {
  return (await projectsOf({ root })).map((each) => each.test?.name as string);
}

/** A project that tests Vue and React, with one case. */
function twoTargets(): string {
  return project({
    "unframework.config.ts":
      'const targets: readonly ("vue" | "react")[] = ["vue", "react"];\nexport default { targets };\n',
    "test/badge/Badge.uf.tsx": COMPONENT,
    "test/badge/badge.test.ts": SPEC,
  });
}

/** Each project's name and group. */
async function groups(): Promise<unknown[][]> {
  return (await projectsOf({ root: twoTargets() })).map((each) => [
    each.test?.name,
    each.test?.sequence?.groupOrder,
  ]);
}

describe("discoverCases", () => {
  it("finds a case in any nested directory, its id the directory from the root", () => {
    const root = project({
      "test/forms/field/Field.uf.tsx": COMPONENT,
      "test/forms/field/field.test.ts": SPEC,
      "badge/Badge.uf.tsx": COMPONENT,
      "badge/badge.test.ts": SPEC,
      "node_modules/pkg/case/Case.uf.tsx": COMPONENT,
      "node_modules/pkg/case/case.test.ts": SPEC,
      "dist/case/Case.uf.tsx": COMPONENT,
      "dist/case/case.test.ts": SPEC,
    });
    const cases = discoverCases({ root, include: ["**/*.test.ts"] });
    expect(cases.map((info) => [info.id, info.source])).toEqual([
      ["badge", join(root, "badge/Badge.uf.tsx")],
      ["test/forms/field", join(root, "test/forms/field/Field.uf.tsx")],
    ]);
  });

  it("takes a main source outside the case's directory from case.json", () => {
    const root = project({
      "src/Counter.uf.tsx": COMPONENT,
      "test/counter/counter.test.ts": SPEC,
      "test/counter/case.json": JSON.stringify({
        main: "../../src/Counter.uf.tsx",
        ssr: { initial: { props: { initial: 2 } } },
      }),
    });
    const [counter] = discoverCases({ root, include: ["**/*.test.ts"] });
    expect(counter).toMatchObject({
      id: "test/counter",
      source: join(root, "src/Counter.uf.tsx"),
      config: { ssr: { initial: { props: { initial: 2 } } } },
    });
  });

  it("refuses a directory with two test files, naming the fix", () => {
    const root = project({
      "test/card/Card.uf.tsx": COMPONENT,
      "test/card/card.test.ts": SPEC,
      "test/card/slots.test.ts": SPEC,
    });
    expect(() => discoverCases({ root, include: ["**/*.test.ts"] })).toThrow(
      "[uf] Case test/card holds 2 test files (card.test.ts, slots.test.ts): a case is a directory with one test file, so give each its own directory.",
    );
  });

  it("refuses a case without a main source, or with several and none named", () => {
    const none = project({ "test/empty/empty.test.ts": SPEC });
    expect(() => discoverCases({ root: none, include: ["**/*.test.ts"] })).toThrow(
      /Case test\/empty has no main source: add a \.uf\.tsx beside its test, or name the component in case\.json/,
    );
    const several = project({
      "test/pair/A.uf.tsx": COMPONENT,
      "test/pair/B.uf.tsx": COMPONENT,
      "test/pair/pair.test.ts": SPEC,
    });
    expect(() => discoverCases({ root: several, include: ["**/*.test.ts"] })).toThrow(
      'Case test/pair holds A.uf.tsx, B.uf.tsx: name the one the test mounts in case.json, "main": "A.uf.tsx".',
    );
    const missing = project({
      "test/gone/gone.test.ts": SPEC,
      "test/gone/case.json": JSON.stringify({ main: "../../src/Gone.uf.tsx" }),
    });
    expect(() => discoverCases({ root: missing, include: ["**/*.test.ts"] })).toThrow(
      /case\.json's "main" names "\.\.\/\.\.\/src\/Gone\.uf\.tsx", which is no \.uf\.tsx file/,
    );
  });

  it("refuses a test file at the root, which is no case's directory", () => {
    const root = project({ "Badge.uf.tsx": COMPONENT, "badge.test.ts": SPEC });
    expect(() => discoverCases({ root, include: ["**/*.test.ts"] })).toThrow(
      /badge\.test\.ts is at the project's root: a case is a directory/,
    );
  });

  it("refuses a malformed case.json, naming each problem", () => {
    const root = project({
      "test/bad/Bad.uf.tsx": COMPONENT,
      "test/bad/bad.test.ts": SPEC,
      "test/bad/case.json": JSON.stringify({
        requires: "x",
        axe: "image-alt",
        colorScheme: "blue",
        reference: "lit",
        ssr: { "Not Kebab": { props: [] } },
      }),
    });
    expect(() => discoverCases({ root, include: ["**/*.test.ts"] })).toThrow(
      /unknown key "requires".*"reference" must name a target.*"colorScheme" must be one of.*"axe" must be a list.*SSR scenario "Not Kebab", which is not kebab-case.*SSR scenario "Not Kebab" must be/s,
    );
    const broken = project({
      "test/bad/Bad.uf.tsx": COMPONENT,
      "test/bad/bad.test.ts": SPEC,
      "test/bad/case.json": "{",
    });
    expect(() => discoverCases({ root: broken, include: ["**/*.test.ts"] })).toThrow(
      /Case test\/bad: case\.json is not JSON/,
    );
  });

  it("finds nothing in an empty project", () => {
    expect(discoverCases({ root: project({}), include: ["**/*.test.ts"] })).toEqual([]);
  });
});

describe("defineTestConfig", () => {
  it("gives a browser and an ssr project for exactly the config's targets", async () => {
    delete process.env.UF_TARGETS;
    expect(await projectNames(twoTargets())).toEqual([
      "browser:vue",
      "ssr:vue",
      "browser:react",
      "ssr:react",
    ]);
  });

  it("adds the reference to a run that selects targets without it", async () => {
    process.env.UF_TARGETS = "react";
    expect(await projectNames(twoTargets())).toEqual([
      "browser:vue",
      "ssr:vue",
      "browser:react",
      "ssr:react",
    ]);
  });

  it("orders the reference first in live mode, and before the others in update mode", async () => {
    delete process.env.UF_TARGETS;
    expect(await groups()).toEqual([
      ["browser:vue", 0],
      ["ssr:vue", 0],
      ["browser:react", 1],
      ["ssr:react", 0],
    ]);
    // An update run, which CI refuses: this test runs in CI too.
    delete process.env.CI;
    process.env.UF_UPDATE = "1";
    expect(await groups()).toEqual([
      ["browser:vue", 1],
      ["ssr:vue", 1],
      ["browser:react", 2],
      ["ssr:react", 2],
    ]);
  });

  it("refuses a target the project doesn't test, and an invalid configuration", async () => {
    process.env.UF_TARGETS = "svelte";
    await expect(defineTestConfig({ root: twoTargets() })).rejects.toThrow(
      "[uf] UF_TARGETS names svelte, which is not among the project's targets (vue, react).",
    );
    delete process.env.UF_TARGETS;
    await expect(defineTestConfig({ root: twoTargets(), reference: "svelte" })).rejects.toThrow(
      /reference names svelte, which is not among the project's targets/,
    );
    const invalid = project({ "unframework.config.mjs": 'export default { targets: ["lit"] };\n' });
    await expect(defineTestConfig({ root: invalid })).rejects.toThrow(
      /unframework\.config\.mjs is invalid:\n {2}UF7003/,
    );
  });

  it("refuses a project with nothing to test", async () => {
    const root = project({ "unframework.config.mjs": 'export default { targets: ["vue"] };\n' });
    await expect(defineTestConfig({ root })).rejects.toThrow(
      `[uf] No test file under ${root} matches **/*.test.ts: a case is a directory with one test file`,
    );
  });

  it("refuses a case the run cannot tell apart before any project loads", async () => {
    const root = project({
      "unframework.config.mjs": 'export default { targets: ["vue"] };\n',
      "test/two/Two.uf.tsx": COMPONENT,
      "test/two/a.test.ts": SPEC,
      "test/two/b.test.ts": SPEC,
    });
    await expect(defineTestConfig({ root })).rejects.toThrow(/Case test\/two holds 2 test files/);
  });

  it("provides the run, the cases and the server render spec to each project", async () => {
    delete process.env.UF_TARGETS;
    const root = twoTargets();
    const [browser, ssr] = await projectsOf({ root });
    expect(browser!.test?.include).toEqual([join(root, "test/badge/badge.test.ts")]);
    // Installed, a pre-bundled copy of the package would hold its own Vitest runner.
    expect(browser!.optimizeDeps?.exclude).toContain("@unframework.dev/testing");
    // Pre-bundled, Qwik's mount adapter would skip Qwik's plugin, and its `$()` would throw.
    expect(browser!.optimizeDeps?.exclude).toContain("@unframework.dev/target-qwik");
    // A module that fails to compile fails its own spec, never the pages of the others.
    expect((browser!.plugins ?? []).flat().map((plugin) => (plugin as Plugin)?.name)).toContain(
      NO_ERROR_BROADCAST,
    );
    expect(browser!.test?.provide).toMatchObject({
      target: "vue",
      ufHarness: { casesDir: root, reference: "vue", pixels: "live", cases: { "test/badge": {} } },
      ufNoOutput: {},
    });
    // `view.expectThrown` calls `ufMapStack`, and the matchers `ufAriaSnapshot` (ADR-0085).
    expect(browser!.test?.browser?.commands).toHaveProperty("ufMapStack");
    expect(browser!.test?.browser?.commands).toHaveProperty("ufAriaSnapshot");
    expect(ssr!.test?.include).toEqual([expect.stringMatching(/src\/ssr\/spec\.ts$/)]);
    expect(ssr!.test?.exclude).toEqual([]);
    // Installed, the package is ESM under node_modules: inlined, its imports of each case's
    // `.uf.tsx` go through the unplugin, not to Node.
    // The targets' server renderers too, so they share the component's copy of its framework.
    expect(ssr!.test?.server?.deps?.inline).toEqual([TESTING_PACKAGE, TARGET_PACKAGES]);
    expect(ssr!.test?.provide).toMatchObject({
      ufServer: "@unframework.dev/target-vue/toolchain/server",
      ufSsrCases: [
        {
          id: "test/badge",
          dir: join(root, "test/badge"),
          source: join(root, "test/badge/Badge.uf.tsx"),
        },
      ],
    });
  });
});

describe("noErrorBroadcast", () => {
  it("keeps a compile error off every page, and passes every other message on", () => {
    const sent: unknown[] = [];
    const hot = { send: (payload: unknown) => void sent.push(payload) };
    const server = { environments: { client: { hot } } } as unknown as ViteDevServer;
    const hook = noErrorBroadcast().configureServer as (server: ViteDevServer) => void;
    hook(server);
    hot.send({ type: "error", err: { message: "UF1002" } });
    hot.send({ type: "full-reload" });
    hot.send("custom");
    expect(sent).toEqual([{ type: "full-reload" }, "custom"]);
  });
});

describe("toolchainDirOf", () => {
  it("takes toolchainDirs relative to the root, then resolveFrom, then the root", () => {
    const from = { angular: "/repo/tests/toolchains/angular" };
    expect(toolchainDirOf("angular", "/p", { angular: "../tools" }, from)).toBe("/tools");
    expect(toolchainDirOf("angular", "/p", { angular: "/abs/tools" }, from)).toBe("/abs/tools");
    expect(toolchainDirOf("angular", "/p", undefined, from)).toBe("/repo/tests/toolchains/angular");
    expect(toolchainDirOf("vue", "/p", { angular: "../tools" }, from)).toBe("/p");
    expect(toolchainDirOf("vue", "/p", undefined, "/shared")).toBe("/shared");
  });
});

describe("TESTING_PACKAGE", () => {
  it("matches the package wherever npm or pnpm installs it, and nothing else", () => {
    for (const path of [
      "/p/node_modules/@unframework.dev/testing/dist/ssr/index.js",
      "/p/node_modules/.pnpm/@unframework.dev+testing@0.1.0/node_modules/@unframework.dev/testing/dist/ssr/index.js",
      "C:\\p\\node_modules\\@unframework.dev\\testing\\dist\\ssr\\index.js",
    ]) {
      expect(path).toMatch(TESTING_PACKAGE);
    }
    for (const path of [
      "/p/node_modules/@unframework.dev/testing-extra/dist/index.js",
      "/p/node_modules/@unframework.dev/codegen/dist/index.js",
      "/repo/packages/testing/src/ssr/index.ts",
    ]) {
      expect(path).not.toMatch(TESTING_PACKAGE);
    }
  });
});

describe("TARGET_PACKAGES", () => {
  it("matches every target package wherever npm or pnpm installs it, and nothing else", () => {
    for (const path of [
      "/p/node_modules/@unframework.dev/target-angular/dist/toolchain/server.js",
      "/p/node_modules/.pnpm/@unframework.dev+target-qwik@0.1.0/node_modules/@unframework.dev/target-qwik/dist/toolchain/server.js",
      "C:\\p\\node_modules\\@unframework.dev\\target-svelte\\dist\\toolchain\\server.js",
    ]) {
      expect(path).toMatch(TARGET_PACKAGES);
    }
    for (const path of [
      "/p/node_modules/@unframework.dev/testing/dist/ssr/index.js",
      "/p/node_modules/@unframework.dev/codegen/dist/index.js",
      "/p/node_modules/@angular/core/fesm2022/core.mjs",
      "/repo/packages/target-angular/src/toolchain/server.ts",
    ]) {
      expect(path).not.toMatch(TARGET_PACKAGES);
    }
  });
});

describe("selectedTargets and runTargets", () => {
  it("selects every target by default, and the named ones in the project's order", () => {
    expect(selectedTargets(undefined, ["vue", "react"])).toEqual(["vue", "react"]);
    expect(selectedTargets(" ", ["vue", "react"])).toEqual(["vue", "react"]);
    expect(selectedTargets("react, vue", ["vue", "react"])).toEqual(["vue", "react"]);
    expect(() => selectedTargets("vue,nope,lit", ["vue"])).toThrow(
      "[uf] UF_TARGETS names nope, lit, which are not among the project's targets (vue).",
    );
  });

  it("always runs the targets that write what the others compare with", () => {
    expect(runTargets(["vue", "react", "svelte"], ["svelte"], ["vue"])).toEqual(["vue", "svelte"]);
    expect(runTargets(["react", "svelte"], ["svelte"], ["react"])).toEqual(["react", "svelte"]);
  });
});

describe("parseTestArguments", () => {
  it("reads the targets, the update flag and Vitest's arguments", () => {
    expect(
      parseTestArguments([
        "--target",
        "react",
        "--target=vue",
        "--update",
        "--",
        "--reporter=json",
        "--target",
      ]),
    ).toEqual({
      targets: ["react", "vue"],
      update: true,
      vitest: ["--reporter=json", "--target"],
    });
    expect(parseTestArguments([])).toEqual({ targets: [], update: false, vitest: [] });
  });

  it("prints Vitest's help for -- --help, and runs nothing", async () => {
    const io = { cwd: project({}), stdout: () => undefined, stderr: () => undefined };
    // A project with no test file would fail at startup, so 0 means nothing started.
    expect(await run(["--", "--help"], io)).toBe(0);
  });

  it("refuses an unknown target, a missing name and an unknown argument", () => {
    expect(() => parseTestArguments(["--target", "nope"])).toThrow(
      "unknown target nope. The targets are react, vue, svelte, solid, angular, qwik, astro.",
    );
    expect(() => parseTestArguments(["--target"])).toThrow("--target needs a target's name");
    expect(() => parseTestArguments(["--target", "--update"])).toThrow("--target needs");
    expect(() => parseTestArguments(["--reporter=json"])).toThrow(
      'unknown argument "--reporter=json". Pass Vitest\'s own options after --',
    );
  });
});
