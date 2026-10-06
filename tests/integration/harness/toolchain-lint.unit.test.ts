// L5 is one contract checked seven times (ADR-0042): every toolchain's oxlint runs one baseline
// configuration, identical but for the framework an output may import; and every toolchain's
// `lint` catches a probe that breaks two baseline rules and one of its framework's own rules, in
// the target's own syntax, which proves its configuration and its plugins load and run. The
// baselines are compared as oxlint reads them (`--print-config`, which expands the categories
// into rules), not as the files are written. Comparing them is not enough on its own: oxlint
// lints a `.vue`, `.svelte` or `.astro` file's script without `no-unused-vars`, which cannot see
// the markup's reads, so those toolchains run typescript-eslint's rule in ESLint instead. The
// probes check that an output one target's lint rejects for a baseline rule, every target's
// does.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { resolveToolBin } from "@unframework/codegen/toolchain-node";
import { afterAll, describe, expect, it } from "vitest";

import { ROOT, toolchainDir } from "./paths.ts";
import { loadToolchain, selectTargets } from "./targets.ts";

/** What an output may import, besides its siblings (M3): its framework only (P7, D11). */
const ALLOWED_IMPORTS: Record<string, readonly string[]> = {
  react: ["react", "react/*"],
  vue: ["vue", "vue/*"],
  svelte: ["svelte", "svelte/*"],
  solid: ["solid-js", "solid-js/*"],
  angular: ["@angular/core", "@angular/common"],
  qwik: ["@qwik.dev/core", "@qwik.dev/core/*"],
  astro: ["astro", "astro/*"],
};

/**
 * Where each target's framework rules run: in oxlint, as the configuration's one override, or
 * in ESLint (`eslint.config.js`), for a template language oxlint cannot read.
 */
const FRAMEWORK_LAYER: Record<string, "oxlint" | "eslint"> = {
  react: "oxlint",
  solid: "oxlint",
  qwik: "oxlint",
  vue: "eslint",
  svelte: "eslint",
  astro: "eslint",
  angular: "eslint",
};

/** A baseline rule every probe breaks: a statement no output has a reason to hold. */
const BASELINE_RULE = "no-debugger";

/**
 * The baseline's unused-variable rule, which every probe breaks with a binding nothing reads,
 * as each target's lint names it: oxlint's, or typescript-eslint's in ESLint where oxlint does
 * not run it (a template language's script, whose bindings the markup reads).
 */
const UNUSED_RULE: Record<string, string> = {
  react: "no-unused-vars",
  solid: "no-unused-vars",
  qwik: "no-unused-vars",
  angular: "no-unused-vars",
  vue: "@typescript-eslint/no-unused-vars",
  svelte: "@typescript-eslint/no-unused-vars",
  astro: "@typescript-eslint/no-unused-vars",
};

/**
 * Each target's probe, and the framework rule it breaks besides {@link BASELINE_RULE} and
 * {@link UNUSED_RULE}. But for Angular's, whose template reads the class, its markup reads a
 * binding beside the unused one, which must not count.
 */
const PROBES: Record<string, { file: string; contents: string; rule: string }> = {
  react: {
    file: "Probe.tsx",
    contents: [
      "export default function Probe() {",
      "  debugger;",
      '  const label = "Hi";',
      "  const unused = 1;",
      '  return <p class="x">{label}</p>;',
      "}",
      "",
    ].join("\n"),
    rule: "react/no-unknown-property",
  },
  solid: {
    file: "Probe.tsx",
    contents: [
      "export default function Probe() {",
      "  debugger;",
      '  const label = "Hi";',
      "  const unused = 1;",
      '  return <p className="x">{label}</p>;',
      "}",
      "",
    ].join("\n"),
    rule: "solid/no-react-specific-props",
  },
  qwik: {
    file: "Probe.tsx",
    contents: [
      'import { component$ } from "@qwik.dev/core";',
      "",
      "export default component$(() => {",
      "  debugger;",
      '  const label = "Hi";',
      "  const unused = 1;",
      '  return <p className="x">{label}</p>;',
      "});",
      "",
    ].join("\n"),
    rule: "qwik/no-react-props",
  },
  vue: {
    file: "Probe.vue",
    contents: [
      '<script setup lang="ts">',
      "debugger;",
      'const html = "Hi";',
      "const unused = 1;",
      "</script>",
      "",
      "<template>",
      '  <p v-html="html"></p>',
      "</template>",
      "",
    ].join("\n"),
    rule: "vue/no-v-html",
  },
  svelte: {
    file: "Probe.svelte",
    contents: [
      '<script lang="ts">',
      "  debugger;",
      '  const html = "Hi";',
      "  const unused = 1;",
      "</script>",
      "",
      "<p>{@html html}</p>",
      "",
    ].join("\n"),
    rule: "svelte/no-at-html-tags",
  },
  astro: {
    file: "Probe.astro",
    contents: [
      "---",
      "debugger;",
      'const html = "Hi";',
      "const unused = 1;",
      "---",
      "",
      "<p set:html={html} />",
      "",
    ].join("\n"),
    rule: "astro/no-set-html-directive",
  },
  angular: {
    file: "probe.ts",
    contents: [
      'import { Component } from "@angular/core";',
      "",
      "@Component({",
      '  selector: "uf-probe",',
      '  template: `<p *ngIf="true">Hi</p>`,',
      "})",
      "export default class Probe {",
      "  constructor() {",
      "    debugger;",
      "    const unused = 1;",
      "  }",
      "}",
      "",
    ].join("\n"),
    rule: "@angular-eslint/template/prefer-control-flow",
  },
};

const TARGETS = selectTargets(undefined);

/** A rule's setting as `--print-config` prints it: a severity, or a severity and its options. */
type RuleSetting = string | [string, unknown[]];

/** The parts of oxlint's effective configuration this test reads. */
interface EffectiveConfig {
  rules: Record<string, RuleSetting>;
  /** Absent without overrides. */
  overrides?: { files: string[]; rules: Record<string, RuleSetting> }[];
  [key: string]: unknown;
}

/** The configuration oxlint lints a toolchain's outputs with. */
function effectiveConfig(target: string): EffectiveConfig {
  const directory = toolchainDir(target);
  const result = spawnSync(
    process.execPath,
    [
      resolveToolBin(directory, "oxlint", "oxlint"),
      `--config=${join(directory, "output.oxlintrc.json")}`,
      "--print-config",
    ],
    { cwd: directory, encoding: "utf8" },
  );
  expect(result.status, result.stdout + result.stderr).toBe(0);
  return JSON.parse(result.stdout) as EffectiveConfig;
}

/** The `group` of each `no-restricted-imports` pattern: what an output may import. */
function importGroups(config: EffectiveConfig): unknown {
  const setting = config.rules["no-restricted-imports"];
  const [options] = Array.isArray(setting) ? setting[1] : [];
  return (options as { patterns?: { group?: unknown }[] } | undefined)?.patterns?.map(
    (pattern) => pattern.group,
  );
}

describe("every toolchain's oxlint configuration", () => {
  const configs = new Map(TARGETS.map((target) => [target, effectiveConfig(target)]));

  it.each(TARGETS)("%s allows imports of its framework only", (target) => {
    expect(importGroups(configs.get(target)!)).toEqual([
      ["*", ...ALLOWED_IMPORTS[target]!.map((name) => `!${name}`), "!./**", "!../**"],
    ]);
  });

  it("holds the same baseline on every target, but for the import allow-list", () => {
    const baselines = TARGETS.map((target) => {
      const { overrides: _framework, rules, ...rest } = configs.get(target)!;
      const { "no-restricted-imports": _allowList, ...baselineRules } = rules;
      return { target, baseline: { ...rest, rules: baselineRules } };
    });
    const [first] = baselines;
    for (const { target, baseline } of baselines) {
      expect(baseline, `${target} and ${first!.target}`).toEqual(first!.baseline);
    }
  });

  it.each(TARGETS)("%s runs its framework's rules in one layer, on every file", (target) => {
    const { overrides = [] } = configs.get(target)!;
    const eslintConfig = existsSync(join(toolchainDir(target), "eslint.config.js"));
    if (FRAMEWORK_LAYER[target] === "oxlint") {
      expect(overrides.map((override) => override.files)).toEqual([["**/*"]]);
      expect(eslintConfig).toBe(false);
    } else {
      expect(overrides).toEqual([]);
      expect(eslintConfig).toBe(true);
    }
  });
});

describe("every toolchain's lint", () => {
  // Inside the integration package, so the probes sit where outputs do.
  mkdirSync(join(ROOT, ".uf-tmp"), { recursive: true });
  const scratch = mkdtempSync(join(ROOT, ".uf-tmp", "lint-"));
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  it.each(TARGETS)(
    "%s rejects a probe that breaks two baseline rules and a framework rule",
    { timeout: 120_000 },
    async (target) => {
      const directory = join(scratch, target);
      mkdirSync(directory);
      const { file, contents, rule } = PROBES[target]!;
      const probe = join(directory, file);
      writeFileSync(probe, contents);
      const toolchain = await loadToolchain(target);
      const results = await toolchain.lint([probe], {
        toolchainDir: toolchainDir(target),
        root: ROOT,
      });
      expect([...results.keys()]).toEqual([probe]);
      const codes = results.get(probe)!.map((message) => message.code ?? message.message);
      expect(codes.toSorted(), JSON.stringify(results.get(probe), null, 2)).toEqual(
        [BASELINE_RULE, UNUSED_RULE[target]!, rule].toSorted(),
      );
    },
  );
});
