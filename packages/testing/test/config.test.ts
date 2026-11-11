// defineTestConfig and its case discovery (ADR-0086), on throwaway projects outside the
// repository: the projects a configuration's targets give, the reference that always joins a run,
// and the layouts a case may take.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterAll, afterEach, describe, expect, it } from "vitest";
import type { TestProjectInlineConfiguration } from "vitest/config";

import { parseTestArguments } from "../src/cli.ts";
import { discoverCases } from "../src/config/cases.ts";
import { defineTestConfig, runTargets, selectedTargets } from "../src/config/index.ts";

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

const env = { targets: process.env.UF_TARGETS, update: process.env.UF_UPDATE };
afterEach(() => {
  if (env.targets === undefined) delete process.env.UF_TARGETS;
  else process.env.UF_TARGETS = env.targets;
  if (env.update === undefined) delete process.env.UF_UPDATE;
  else process.env.UF_UPDATE = env.update;
});

/** The names of a configuration's projects, in order. */
async function projectNames(root: string): Promise<string[]> {
  const config = await defineTestConfig({ root });
  return (config.test?.projects as TestProjectInlineConfiguration[]).map(
    (each) => each.test?.name as string,
  );
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
  const twoTargets = () =>
    project({
      "unframework.config.mjs": 'export default { targets: ["vue", "react"] };\n',
      "test/badge/Badge.uf.tsx": COMPONENT,
      "test/badge/badge.test.ts": SPEC,
    });

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
    const groups = async () =>
      (
        (await defineTestConfig({ root: twoTargets() })).test
          ?.projects as TestProjectInlineConfiguration[]
      ).map((each) => [each.test?.name, each.test?.sequence?.groupOrder]);
    expect(await groups()).toEqual([
      ["browser:vue", 0],
      ["ssr:vue", 0],
      ["browser:react", 1],
      ["ssr:react", 0],
    ]);
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
    const [browser, ssr] = (await defineTestConfig({ root })).test
      ?.projects as TestProjectInlineConfiguration[];
    expect(browser!.test?.include).toEqual([join(root, "test/badge/badge.test.ts")]);
    expect(browser!.test?.provide).toMatchObject({
      target: "vue",
      ufHarness: { casesDir: root, reference: "vue", pixels: "live", cases: { "test/badge": {} } },
      ufNoOutput: {},
    });
    expect(browser!.test?.browser?.commands).toHaveProperty("ufMapStack");
    expect(ssr!.test?.include).toEqual([expect.stringMatching(/src\/ssr\/spec\.ts$/)]);
    expect(ssr!.test?.exclude).toEqual([]);
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
