// An output tree holds modules beside its components from M5 on: each `.ts` module a component
// reaches, copied unchanged (ADR-0070), and each composable's own module, `useToggle.ts` or
// Svelte's `useToggle.svelte.ts` (ADR-0069). The toolchain projects hand them to L3, L4 and L5
// with the rest of the tree, so every target's tools must report on each one, and find nothing
// wrong with a correct one. Checked on a golden tree with a module of each kind added.
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { CASES_DIR, ROOT, toolchainDir } from "./paths.ts";
import { loadToolchain, selectTargets } from "./targets.ts";
import {
  frameworkCompileProblems,
  lintProblems,
  toolchainFiles,
  typecheckProblems,
} from "./toolchain-results.ts";

/** A shared module, framework-agnostic, as a case holds it beside its sources (ADR-0070). */
const SHARED = {
  file: "tokens.ts",
  contents: `export type Tone = "info" | "danger";

export const SIZES = Object.freeze({ sm: 8, md: 12 });

export function label(tone: Tone): string {
  return tone.toUpperCase();
}

// A generic arrow, which reads as a JSX tag in a \`.tsx\` file: the module is parsed as \`.ts\`.
export const first = <T>(items: readonly T[]): T | undefined => items[0];
`,
};

/** A composable's output on each target, in the shape ADR-0069 gives it. */
const COMPOSABLES: Record<string, { file: string; contents: string }> = {
  vue: {
    file: "useToggle.ts",
    contents: `import { type ShallowRef, shallowRef } from "vue";

export function useToggle(initial: boolean): { on: ShallowRef<boolean>; toggle: () => void } {
  const on = shallowRef(initial);
  function toggle(): void {
    on.value = !on.value;
  }
  return { on, toggle };
}
`,
  },
  react: {
    file: "useToggle.ts",
    contents: `import { useState } from "react";

export function useToggle(initial: boolean): { on: boolean; toggle: () => void } {
  const [on, setOn] = useState(initial);
  return { on, toggle: () => setOn((value) => !value) };
}
`,
  },
  solid: {
    file: "useToggle.ts",
    contents: `import { type Accessor, createSignal } from "solid-js";

export function useToggle(initial: boolean): { on: Accessor<boolean>; toggle: () => void } {
  const [on, setOn] = createSignal(initial);
  return { on, toggle: () => setOn((value) => !value) };
}
`,
  },
  svelte: {
    file: "useToggle.svelte.ts",
    // With what the author's code may hold and Svelte's rules would judge: a \`watchEffect\` that
    // writes a state (\`$effect\`), and a fresh local \`new Map()\` (ADR-0042).
    contents: `export function useToggle(initial: boolean): {
  readonly on: boolean;
  readonly count: number;
  toggle: () => void;
} {
  let on = $state(initial);
  let count = $state(0);
  $effect(() => {
    count = on ? 1 : 0;
  });
  return {
    get on() {
      return on;
    },
    get count() {
      return count;
    },
    toggle() {
      const seen = new Map<string, boolean>();
      seen.set("on", on);
      on = !seen.get("on");
    },
  };
}
`,
  },
  angular: {
    file: "use-toggle.ts",
    contents: `import { type Signal, signal } from "@angular/core";

export function useToggle(initial: boolean): { on: Signal<boolean>; toggle: () => void } {
  const on = signal(initial);
  return { on: on.asReadonly(), toggle: () => on.update((value) => !value) };
}
`,
  },
  qwik: {
    file: "useToggle.ts",
    contents: `import { $, type QRL, type Signal, useSignal } from "@qwik.dev/core";

export function useToggle(initial: boolean): { on: Signal<boolean>; toggle: QRL<() => void> } {
  const on = useSignal(initial);
  const toggle = $(() => {
    on.value = !on.value;
  });
  return { on, toggle };
}
`,
  },
  astro: {
    file: "useToggle.ts",
    contents: `export function useToggle(initial: boolean): { on: boolean } {
  return { on: initial };
}
`,
  },
};

const TARGETS = selectTargets(undefined);

describe("every toolchain", () => {
  // Inside the integration package, so the modules resolve each framework as the outputs do.
  mkdirSync(join(ROOT, ".uf-tmp"), { recursive: true });
  const scratch = mkdtempSync(join(ROOT, ".uf-tmp", "modules-"));
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  it.each(TARGETS)(
    "%s checks an output tree's .ts modules at L3, L4 and L5",
    { timeout: 120_000 },
    async (target) => {
      const directory = join(scratch, target);
      cpSync(join(CASES_DIR, "basics", "hello", "__output__", target), directory, {
        recursive: true,
      });
      for (const { file, contents } of [SHARED, COMPOSABLES[target]!]) {
        writeFileSync(join(directory, file), contents);
      }
      const files = toolchainFiles(readdirSync(directory).map((file) => join(directory, file)));
      const outputs = new Set(files);
      const toolchain = await loadToolchain(target);
      const context = { toolchainDir: toolchainDir(target), root: ROOT };
      const [compiled, checked, linted] = await Promise.all([
        toolchain.frameworkCompile(
          files.map((path) => ({ path, contents: readFileSync(path, "utf8") })),
          context,
        ),
        toolchain.typecheck(files, context),
        toolchain.lint(files, context),
      ]);
      const problems = [
        ...frameworkCompileProblems(compiled, files, outputs),
        ...typecheckProblems(checked, files, outputs),
        ...lintProblems(linted, files, outputs),
      ];
      expect(problems, problems.join("\n")).toEqual([]);
    },
  );

  it.each(TARGETS)(
    "%s fails a module its framework compiler cannot read at L3",
    { timeout: 120_000 },
    async (target) => {
      const directory = join(scratch, `${target}-broken`);
      mkdirSync(directory);
      const { file } = COMPOSABLES[target]!;
      const broken = join(directory, file);
      writeFileSync(broken, "export const size: = 1;\n");
      const toolchain = await loadToolchain(target);
      const compiled = await toolchain.frameworkCompile(
        [{ path: broken, contents: readFileSync(broken, "utf8") }],
        { toolchainDir: toolchainDir(target), root: ROOT },
      );
      expect(
        compiled.get(broken)?.errors.length,
        JSON.stringify(compiled.get(broken)),
      ).toBeGreaterThan(0);
    },
  );
});
