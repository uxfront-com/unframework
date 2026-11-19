// Target options as the built-in targets declare them (ADR-0076, ADR-0112): the config loader
// reports an invalid one as UF7004, `compile()` throws it as UF7004 before it emits anything, and
// a target emits with, and is checked against, the value its schema returns.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { defineTarget } from "@unframework.dev/codegen";
import type { Target } from "@unframework.dev/codegen";
import { afterEach, describe, expect, it } from "vitest";

import {
  builtinTargets,
  checkCapabilities,
  compile,
  loadConfig,
  resolveConfig,
} from "../src/index.ts";

const COUNTER = `import { ref } from "@uxfront/unframework";

export default function Counter() {
  const count = ref(0);
  return <button type="button" onClick={() => count.value++}>{count.value}</button>;
}
`;

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

/** The diagnostics of a project whose `unframework.config.ts` gives these target options. */
async function configProblems(targetOptions: string): Promise<[string, string][]> {
  const root = mkdtempSync(join(tmpdir(), "uf-target-options-"));
  directories.push(root);
  writeFileSync(
    join(root, "unframework.config.ts"),
    `export default { targets: ["vue"], targetOptions: ${targetOptions} };\n`,
  );
  const loaded = await loadConfig(root);
  expect(loaded.diagnostics).toEqual([]);
  const { config, diagnostics } = await resolveConfig(loaded.raw, loaded);
  expect(config).toBeUndefined();
  return diagnostics.map(({ code, message }) => [code, message]);
}

describe("the Vue target's options", () => {
  it.each([
    [
      '{ vue: { vapor: "yes" } }',
      'The configuration at "/targetOptions/vue/vapor" is not valid: must be `true` or `false`.',
    ],
    [
      "{ vue: { vapour: true } }",
      'The configuration at "/targetOptions/vue/vapour" is not valid: is not an option of the vue target, which takes `vapor`.',
    ],
    [
      "{ vue: true }",
      'The configuration at "/targetOptions/vue" is not valid: must be an object, such as `{ vapor: true }`.',
    ],
  ])("reports %s from the config as UF7004", async (options, message) => {
    expect(await configProblems(options)).toEqual([["UF7004", message]]);
  });

  it("keeps what the schema returns, every default filled in", async () => {
    const { config } = await resolveConfig({ targetOptions: { vue: {} } });
    expect(config?.targetOptions).toEqual({ vue: { vapor: false } });
  });

  it.each([
    [{ vapor: "yes" }, "UF7004 /targetOptions/vue/vapor is not valid: must be `true` or `false`."],
    [
      { vapour: true },
      "UF7004 /targetOptions/vue/vapour is not valid: is not an option of the vue target, which takes `vapor`.",
    ],
  ])("makes compile() throw %j as UF7004, before it emits", async (options, message) => {
    await expect(
      compile(COUNTER, {
        filename: "Counter.uf.tsx",
        targets: ["vue"],
        targetOptions: { vue: options },
      }),
    ).rejects.toThrow(new TypeError(message));
  });

  it("checks only the selected targets' options", async () => {
    const result = await compile(COUNTER, {
      filename: "Counter.uf.tsx",
      targets: ["react"],
      targetOptions: { vue: { vapor: "yes" } },
    });
    expect(result.outputs.react).toHaveLength(1);
  });

  it("emits Vapor components with `vapor`, and Vue's own without", async () => {
    const compiled = async (targetOptions?: Record<string, unknown>) =>
      (
        await compile(COUNTER, {
          filename: "Counter.uf.tsx",
          targets: ["vue"],
          ...(targetOptions ? { targetOptions } : {}),
        })
      ).outputs.vue![0]!.contents;
    expect(await compiled({ vue: { vapor: true } })).toMatch(/^<script setup vapor lang="ts">/);
    expect(await compiled({ vue: { vapor: false } })).toMatch(/^<script setup lang="ts">/);
    expect(await compiled()).toBe(await compiled({ vue: { vapor: false } }));
  });
});

describe("a target's options and its capabilities", () => {
  /** A target whose `next-tick` cell its `strict` option makes unsupported. */
  const strict: Target = defineTarget({
    name: "strict",
    framework: { package: "strict", range: "*" },
    capabilities: builtinTargets.vue.capabilities,
    options: {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: (value: unknown) => ({
          value: { strict: (value as { on?: boolean }).on === true },
        }),
      },
    },
    capabilitiesFor: (options) =>
      (options as { strict: boolean }).strict
        ? {
            "next-tick": {
              support: "unsupported",
              code: "UF4001",
              severity: "error",
              reason: "the strict option renders synchronously.",
            },
          }
        : {},
    emit: () => [{ path: "Out.txt", contents: "out\n" }],
  });

  const SOURCE = `import { nextTick, ref } from "@uxfront/unframework";

export default function Tick() {
  const count = ref(0);
  async function bump() {
    count.value++;
    await nextTick();
  }
  return <button type="button" onClick={bump}>{count.value}</button>;
}
`;

  it("checks a module against the cells the validated options change", async () => {
    const codes = async (on: boolean) =>
      (
        await compile(SOURCE, {
          filename: "Tick.uf.tsx",
          targets: [strict],
          targetOptions: { strict: { on } },
        })
      ).diagnostics.map(({ code, message }) => `${code} ${message}`);
    expect(await codes(true)).toEqual([
      "UF4001 The strict target does not support next-tick: the strict option renders synchronously.",
    ]);
    expect(await codes(false)).toEqual([]);
  });

  it("is the target's own matrix without options", async () => {
    const { ir } = await compile(SOURCE, { filename: "Tick.uf.tsx", targets: [] });
    expect(checkCapabilities(ir!, strict)).toEqual([]);
    expect(checkCapabilities(ir!, strict, { strict: true })).toHaveLength(1);
  });
});
