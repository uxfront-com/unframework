// L4 is one contract checked seven times: every target's checker runs with the same type
// strictness, so an output that one target's checker rejects is rejected by all of them, and a
// lowering shared by the targets cannot fail on React and pass on Vue. Checked twice: each
// toolchain tsconfig's effective options (tsgo's --showConfig resolves `extends`, which Astro's
// uses), and each real checker on a probe that breaks each flag, in its target's own syntax.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { REPO_ROOT, ROOT, toolchainDir } from "./paths.ts";
import { loadToolchain, selectTargets } from "./targets.ts";

/** The options that decide which programs type-check: every toolchain sets each of them. */
const CONTRACT = [
  "strict",
  "noUncheckedIndexedAccess",
  "noImplicitOverride",
  "noPropertyAccessFromIndexSignature",
  "noImplicitReturns",
  "noFallthroughCasesInSwitch",
  "verbatimModuleSyntax",
  "isolatedModules",
] as const;

/** The error each checker must report on the probe, for each flag the probe breaks. */
const PROBE_ERRORS: Partial<Record<(typeof CONTRACT)[number], string>> = {
  noUncheckedIndexedAccess: "TS2322",
  noImplicitOverride: "TS4114",
  noPropertyAccessFromIndexSignature: "TS4111",
  noImplicitReturns: "TS7030",
  noFallthroughCasesInSwitch: "TS7029",
  verbatimModuleSyntax: "TS1484",
};

/** A script that breaks each flag of {@link PROBE_ERRORS} once, and nothing else. */
const PROBE = `import { Shape } from "./shape";
const sides: Shape[] = [];
const first: Shape = sides[0];
class Base {
  area(): number {
    return 0;
  }
}
class Square extends Base {
  area(): number {
    return 1;
  }
}
const named: Record<string, number> = {};
const width = named.width;
function pick(flag: boolean): number | undefined {
  if (flag) return 1;
}
function label(kind: number): string {
  let text = "";
  switch (kind) {
    case 0:
      text = "zero";
    case 1:
      text = "one";
      break;
  }
  return text;
}
export { first, Square, width, pick, label };
`;

/** The probe as each target's output file: a component in its own syntax around the script. */
const PROBES: Record<string, { file: string; contents: string }> = {
  react: { file: "Probe.tsx", contents: PROBE },
  solid: { file: "Probe.tsx", contents: PROBE },
  qwik: { file: "Probe.tsx", contents: PROBE },
  angular: { file: "probe.ts", contents: PROBE },
  vue: {
    file: "Probe.vue",
    contents: `<script setup lang="ts">\n${PROBE.replace(/^export .*\n/m, "")}</script>\n\n<template>\n  <p>{{ first }} {{ width }} {{ pick(true) }} {{ label(0) }} {{ Square }}</p>\n</template>\n`,
  },
  svelte: {
    file: "Probe.svelte",
    contents: `<script lang="ts">\n${PROBE.replace(/^export .*\n/m, "")}</script>\n\n<p>{first} {width} {pick(true)} {label(0)} {Square}</p>\n`,
  },
  astro: {
    file: "Probe.astro",
    contents: `---\n${PROBE.replace(/^export .*\n/m, "")}---\n\n<p>{first} {width} {pick(true)} {label(0)} {Square}</p>\n`,
  },
};

const TARGETS = selectTargets(undefined);

describe("every toolchain tsconfig", () => {
  it.each(TARGETS)("%s has the contract's options", (target) => {
    const result = spawnSync(
      join(REPO_ROOT, "node_modules", ".bin", "tsc"),
      ["--showConfig", "-p", join(toolchainDir(target), "tsconfig.json")],
      { encoding: "utf8" },
    );
    expect(result.status, result.stderr).toBe(0);
    const { compilerOptions } = JSON.parse(result.stdout) as {
      compilerOptions: Record<string, unknown>;
    };
    expect(compilerOptions).toMatchObject(
      Object.fromEntries(CONTRACT.map((option) => [option, true])),
    );
  });
});

describe("every checker", () => {
  // Inside the integration package, so the probes resolve each framework as its outputs do.
  mkdirSync(join(ROOT, ".uf-tmp"), { recursive: true });
  const scratch = mkdtempSync(join(ROOT, ".uf-tmp", "strictness-"));
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  it.each(TARGETS)(
    "%s rejects the probe under every flag of the contract",
    { timeout: 120_000 },
    async (target) => {
      const directory = join(scratch, target);
      mkdirSync(directory);
      writeFileSync(join(directory, "shape.ts"), "export interface Shape {\n  side: number;\n}\n");
      const probe = join(directory, PROBES[target]!.file);
      writeFileSync(probe, PROBES[target]!.contents);
      const toolchain = await loadToolchain(target);
      const results = await toolchain.typecheck([probe], {
        toolchainDir: toolchainDir(target),
        root: ROOT,
      });
      const codes = (results.get(probe) ?? []).map((message) => message.code ?? message.message);
      expect(codes.toSorted(), JSON.stringify(results.get(probe), null, 2)).toEqual(
        Object.values(PROBE_ERRORS).toSorted(),
      );
    },
  );
});
