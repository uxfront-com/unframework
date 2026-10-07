// L5 is one contract checked seven times (ADR-0042): every toolchain's oxlint runs one baseline
// configuration, identical but for the framework an output may import; and every toolchain's
// `lint` catches a probe that breaks two baseline rules and one of its framework's own rules, in
// the target's own syntax, which proves its configuration and its plugins load and run. The
// baselines are compared as oxlint reads them (`--print-config`, which expands the categories
// into rules), not as the files are written. Comparing them is not enough on its own: oxlint
// lints a `.vue`, `.svelte` or `.astro` file's script without `no-unused-vars`, which cannot see
// the markup's reads, so those toolchains run typescript-eslint's rule in ESLint instead. The
// probes check that an output one target's lint rejects for a baseline rule, every target's
// does. Qwik's type-aware rules, which oxlint gives a JS plugin no types for, run in ESLint from
// a lint host on TypeScript 6 beside its toolchain (the M2 amendment of ADR-0042).
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { resolveInstalled, resolveToolBin } from "@unframework/codegen/toolchain-node";
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

/**
 * The type-aware framework rules a toolchain runs in ESLint, from the lint host it installs
 * beside it, on TypeScript 6: typescript-eslint, which gives the rules their types, cannot load
 * the TypeScript 7 the toolchain's tsgo needs (L4). Its oxlint turns them off, and the host runs
 * them alone.
 */
const TYPED_LAYER: Record<string, { host: string; rules: readonly string[] }> = {
  qwik: { host: "qwik-eslint", rules: ["qwik/use-async-top", "qwik/valid-lexical-scope"] },
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
 * Each target's probe, and the framework rules it breaks besides {@link BASELINE_RULE} and
 * {@link UNUSED_RULE}: one, and one of its {@link TYPED_LAYER} too. But for Angular's, whose
 * template reads the class, its markup reads a binding beside the unused one, which must not
 * count.
 */
const PROBES: Record<string, { file: string; contents: string; rules: readonly string[] }> = {
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
    rules: ["react/no-unknown-property"],
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
    rules: ["solid/no-react-specific-props"],
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
      "  function greet() {",
      "    return label;",
      "  }",
      '  return <p className="x" onClick$={() => greet()}>{label}</p>;',
      "});",
      "",
    ].join("\n"),
    rules: ["qwik/no-react-props", "qwik/valid-lexical-scope"],
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
    rules: ["vue/no-v-html"],
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
    rules: ["svelte/no-at-html-tags"],
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
    rules: ["astro/no-set-html-directive"],
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
    rules: ["@angular-eslint/template/prefer-control-flow"],
  },
};

const TARGETS = selectTargets(undefined);

/**
 * The baseline rules that judge only the author's statements (ADR-0042), which every target
 * copies: off on every target.
 */
const AUTHOR_RULES = [
  "unicorn/consistent-function-scoping",
  "unicorn/no-array-reverse",
  "unicorn/no-array-sort",
  "unicorn/no-instanceof-builtins",
  "unicorn/no-new-array",
  "unicorn/no-single-promise-in-promise-methods",
  "unicorn/prefer-add-event-listener",
];

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

  it.each(TARGETS)("%s leaves the author's own statements to the author (ADR-0042)", (target) => {
    // Rules that judge only what the author wrote, which every target copies: where a helper is
    // nested, and one correct spelling over another. The targets' own placement of setup
    // functions (ADR-0045) is pinned by their emitter tests.
    const { rules, overrides = [] } = configs.get(target)!;
    for (const rule of AUTHOR_RULES) {
      expect(rules[rule] ?? "allow", rule).toBe("allow");
      for (const override of overrides) expect(override.rules[rule] ?? "allow", rule).toBe("allow");
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

  it.each(TARGETS.filter((target) => target in TYPED_LAYER))(
    "%s runs its type-aware rules in ESLint alone, from a lint host on TypeScript 6",
    (target) => {
      const { host, rules } = TYPED_LAYER[target]!;
      const directory = join(toolchainDir(target), "..", host);
      const [framework] = configs.get(target)!.overrides ?? [];
      for (const rule of rules) expect(framework?.rules[rule], rule).toBe("allow");
      expect(eslintRules(directory)).toEqual(rules);
      // The rules' plugin resolves TypeScript as it is installed for the host, and the
      // toolchain's checker (tsgo) is TypeScript 7.
      expect(pluginTypescript(directory, "eslint-plugin-qwik")).toMatch(/^6\./);
      expect(pluginTypescript(toolchainDir(target), "eslint-plugin-qwik")).toMatch(/^7\./);
    },
  );
});

/** The rules an ESLint configuration in `directory` turns on for a `.tsx` output, sorted. */
function eslintRules(directory: string): unknown {
  const eslint = resolveInstalled(directory, "eslint");
  expect(eslint, `eslint in ${directory}`).toBeDefined();
  const script = [
    `const api = await import(${JSON.stringify(pathToFileURL(eslint!).href)});`,
    "const { ESLint } = api.ESLint ? api : api.default;",
    'const config = await new ESLint().calculateConfigForFile("Probe.tsx");',
    "const on = Object.entries(config.rules).filter(([, [severity]]) => severity !== 0);",
    "process.stdout.write(JSON.stringify(on.map(([name]) => name).sort()));",
  ].join("\n");
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
    cwd: realpathSync(directory),
    encoding: "utf8",
  });
  expect(result.status, result.stdout + result.stderr).toBe(0);
  return JSON.parse(result.stdout);
}

/** The version of the TypeScript a plugin installed for `directory` loads. */
function pluginTypescript(directory: string, plugin: string): string {
  const manifest = resolveInstalled(directory, `${plugin}/package.json`);
  expect(manifest, `${plugin} in ${directory}`).toBeDefined();
  const result = spawnSync(
    process.execPath,
    ["--print", 'require("typescript/package.json").version'],
    { cwd: dirname(manifest!), encoding: "utf8" },
  );
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}

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
      const { file, contents, rules } = PROBES[target]!;
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
        [BASELINE_RULE, UNUSED_RULE[target]!, ...rules].toSorted(),
      );
    },
  );
});
