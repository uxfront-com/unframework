// @unframework.dev/testing/config: a project's own tests on every target it ships to (plan §8.5,
// ADR-0086). `defineTestConfig` reads the project's `unframework.config.ts` and gives Vitest one
// `browser:<target>` and one `ssr:<target>` project per target, built from the pieces the corpus's
// harness uses (`tests/integration/harness/projects.ts`): each target's toolchain fragment, the
// unplugin, the parity browser with its commands, the testing setup and the provided run.
import { realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Toolchain, ToolchainContext } from "@unframework.dev/codegen";
import { builtinTargets, loadConfig, resolveConfig, TARGET_NAMES } from "@unframework.dev/compiler";
import type { ResolvedConfig, TargetName } from "@unframework.dev/compiler";
import type { UnframeworkOptions } from "@unframework.dev/unplugin/vite";
import type { Plugin } from "vite";
import { mergeConfig } from "vitest/config";
import type { UserWorkspaceConfig, ViteUserConfig } from "vitest/config";

import { caseReferences } from "../harness.ts";
import type { HarnessContext, PixelMode, SsrCase } from "../harness.ts";
import { parityBrowser } from "../node/browser.ts";
import { recordCompiledModule } from "../node/events.ts";
import { createHarnessRun, groupOrder, resolveHarnessMode } from "../node/mode.ts";
import type { HarnessMode, ProjectKind } from "../node/mode.ts";
import { ufMapStack } from "../node/thrown.ts";
import { discoverCases, EXCLUDED } from "./cases.ts";
import type { ProjectCase } from "./cases.ts";

export { discoverCases } from "./cases.ts";
export type { DiscoverOptions, ProjectCase } from "./cases.ts";

/** The options of {@link defineTestConfig}. */
export interface TestConfigOptions {
  /** The targets to test: `unframework.config.ts`'s `targets` by default. */
  targets?: readonly TargetName[];
  /** Globs of test files, relative to the root: `["**\/*.test.ts"]` by default. */
  include?: readonly string[];
  /**
   * The target that writes the shared expectations, which every other target must match: `vue`
   * when the project tests it, the first target otherwise. It always joins the run.
   */
  reference?: TargetName;
  /**
   * What pixels compare with: `live`, every target against the reference's capture in the same
   * run, by default, in CI too; or `baseline`, committed baselines, which only the baseline image
   * writes.
   */
  pixels?: PixelMode;
  /**
   * Where a target's compiler stack resolves from, such as Angular's: `package.resolveFrom` in
   * `unframework.config.ts` by default, then the root.
   */
  toolchainDirs?: Partial<Record<TargetName, string>>;
  /** The project's root, where `unframework.config.ts` lies: the working directory by default. */
  root?: string;
}

/** The test files a project's run finds by default. */
export const DEFAULT_INCLUDE: readonly string[] = ["**/*.test.ts"];

/** How long a test runs at most: a cold browser project's first mount compiles its framework. */
const TEST_TIMEOUT = 60_000;

/**
 * The Vitest configuration of a project's tests: one `browser:<target>` project in Chromium and
 * one `ssr:<target>` project per target, with the reference ordered first. `UF_TARGETS` narrows
 * the targets (`unframework test --target`), and `UF_UPDATE=1` writes the expectations
 * (`--update`). Throws, naming the fix, on an invalid configuration, an unknown target, a case it
 * cannot tell apart and a toolchain that cannot load: a check that cannot start fails.
 */
export async function defineTestConfig(options: TestConfigOptions = {}): Promise<ViteUserConfig> {
  const root = realpathSync(options.root ?? process.cwd());
  const config = await projectConfig(root);
  const targets = options.targets ?? config.targets;
  checkTargets("targets", targets, TARGET_NAMES);
  const reference = options.reference ?? (targets.includes("vue") ? "vue" : targets[0]);
  if (reference === undefined) throw new Error("[uf] defineTestConfig: the project has no target.");
  checkTargets("reference", [reference], targets);

  const mode = resolveHarnessMode({
    env: process.env,
    platform: process.platform,
    // Under `unframework test`, the command line is the CLI's, whose own `--update` is not
    // Vitest's: the CLI refuses Vitest's in what it passes on (`UF_TEST_CLI`).
    argv: process.env.UF_TEST_CLI === "1" ? [] : process.argv,
    project: { pixels: options.pixels ?? "live" },
  });
  if (mode.browser !== "chromium") {
    throw new Error(
      `[uf] A project's tests run in Chromium alone: UF_BROWSER=${mode.browser} cannot apply.`,
    );
  }

  const cases = discoverCases({ root, include: options.include ?? DEFAULT_INCLUDE });
  const harness = createHarnessRun({
    root,
    casesDir: root,
    reference,
    mode,
    quarantine: [],
    cases: Object.fromEntries(cases.map((info) => [info.id, info.config])),
  });
  const named = caseReferences(harness);
  checkTargets("a case's reference", named, targets);
  const run = runTargets(targets, selectedTargets(process.env.UF_TARGETS, targets), [
    reference,
    ...named,
  ]);
  const setup: ProjectSetup = {
    root,
    harness,
    mode,
    cases,
    targets: run,
    toolchainDir: (target) =>
      options.toolchainDirs?.[target] ?? resolveFrom(config, target) ?? root,
  };
  const projects = await Promise.all(
    run.flatMap((target) => [browserProject(setup, target), ssrProject(setup, target)]),
  );
  return { test: { projects } };
}

/** The project's `unframework.config.ts`, resolved, or an error that lists its diagnostics. */
async function projectConfig(root: string): Promise<ResolvedConfig> {
  const loaded = await loadConfig(root);
  const resolved =
    loaded.raw === undefined
      ? { config: undefined, diagnostics: [] }
      : await resolveConfig(loaded.raw, loaded);
  const diagnostics = [...loaded.diagnostics, ...resolved.diagnostics];
  if (!resolved.config || diagnostics.some((each) => each.severity === "error")) {
    throw new Error(
      `[uf] ${loaded.file ?? "unframework.config.ts"} is invalid:\n  ${diagnostics.map((each) => `${each.code} ${each.message}`).join("\n  ")}`,
    );
  }
  return resolved.config;
}

/** Throws unless every name is one of `allowed`. */
function checkTargets(
  what: string,
  names: readonly string[],
  allowed: readonly TargetName[],
): asserts names is readonly TargetName[] {
  const unknown = names.filter((name) => !(allowed as readonly string[]).includes(name));
  if (unknown.length) {
    throw new Error(
      `[uf] defineTestConfig: ${what} names ${unknown.join(", ")}, which ${unknown.length > 1 ? "are" : "is"} not among ${allowed === TARGET_NAMES ? "the targets" : "the project's targets"} (${allowed.join(", ")}).`,
    );
  }
}

/**
 * The targets `UF_TARGETS` selects (`unframework test --target`), every one of the project's when
 * it is unset. A name outside the project's targets throws, so a typo never tests nothing.
 */
export function selectedTargets(
  value: string | undefined,
  targets: readonly TargetName[],
): TargetName[] {
  if (!value?.trim()) return [...targets];
  const requested = value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const unknown = requested.filter((name) => !(targets as readonly string[]).includes(name));
  if (unknown.length) {
    throw new Error(
      `[uf] UF_TARGETS names ${unknown.join(", ")}, which ${unknown.length > 1 ? "are" : "is"} not among the project's targets (${targets.join(", ")}).`,
    );
  }
  return targets.filter((name) => requested.includes(name));
}

/**
 * The targets a run tests, in the project's order: the selected ones, and the reference and every
 * target a case names as its own, which write the expectations and the live captures the others
 * compare with (ADR-0057), so they always join.
 */
export function runTargets(
  targets: readonly TargetName[],
  selected: readonly TargetName[],
  writers: readonly TargetName[],
): TargetName[] {
  return targets.filter((name) => selected.includes(name) || writers.includes(name));
}

/** Where `package.resolveFrom` says a target's tools resolve from, if it says. */
function resolveFrom(config: ResolvedConfig, target: TargetName): string | undefined {
  const from = config.package?.resolveFrom;
  return typeof from === "string" ? from : from?.[target];
}

/** What every project factory reads. */
interface ProjectSetup {
  root: string;
  harness: HarnessContext;
  mode: HarnessMode;
  cases: readonly ProjectCase[];
  targets: readonly TargetName[];
  toolchainDir(target: TargetName): string;
}

function group(setup: ProjectSetup, kind: ProjectKind, target: TargetName): number {
  return groupOrder(
    kind,
    target,
    setup.mode,
    setup.harness.reference,
    caseReferences(setup.harness),
    setup.targets,
  );
}

/** Loads a target's toolchain, refusing one of another name. */
async function loadToolchain(target: TargetName): Promise<Toolchain> {
  let module: { toolchain?: Toolchain; default?: Toolchain };
  try {
    module = (await import(
      /* @vite-ignore */ `@unframework.dev/target-${target}/toolchain`
    )) as typeof module;
  } catch (error) {
    throw new Error(
      `[uf] The ${target} toolchain (@unframework.dev/target-${target}/toolchain) could not be loaded: install the ${target} framework and its Vite plugin.`,
      { cause: error },
    );
  }
  const toolchain = module.toolchain ?? module.default;
  if (!toolchain || toolchain.name !== target) {
    throw new Error(
      `[uf] @unframework.dev/target-${target}/toolchain must export \`toolchain\` with name "${target}".`,
    );
  }
  return toolchain;
}

async function unpluginOf(target: TargetName): Promise<Plugin[]> {
  const { default: unframework } = await import("@unframework.dev/unplugin/vite");
  // Every compile is recorded, so a mount listens to the events of the module it compiled.
  const options: UnframeworkOptions = { target, onCompile: (event) => recordCompiledModule(event) };
  return unframework(options);
}

function toolchainContext(setup: ProjectSetup, target: TargetName): ToolchainContext {
  return { toolchainDir: setup.toolchainDir(target), root: setup.root };
}

type ProjectTest = NonNullable<UserWorkspaceConfig["test"]>;

/**
 * A project's `test` options: the defaults, then the toolchain's own, then the options this
 * configuration owns. A toolchain that sets an owned option throws, as in the harness; setup files
 * add up, this configuration's first.
 */
function projectTest(
  target: TargetName,
  fragment: ViteUserConfig["test"],
  defaults: ProjectTest,
  owned: ProjectTest,
): ProjectTest {
  const toolchain = (fragment ?? {}) as ProjectTest;
  const taken = Object.keys(toolchain).filter((key) => key !== "setupFiles" && key in owned);
  if (taken.length) {
    throw new Error(
      `[uf] The ${target} toolchain's Vite configuration sets ${taken.map((key) => `test.${key}`).join(", ")}, which defineTestConfig owns.`,
    );
  }
  const setupFiles = [owned.setupFiles ?? [], toolchain.setupFiles ?? []].flat();
  return { ...defaults, ...toolchain, ...owned, ...(setupFiles.length ? { setupFiles } : {}) };
}

function resolveModule(specifier: string): string {
  return fileURLToPath(import.meta.resolve(specifier));
}

async function browserProject(
  setup: ProjectSetup,
  target: TargetName,
): Promise<UserWorkspaceConfig> {
  const name = `browser:${target}`;
  const toolchain = await loadToolchain(target);
  const context = toolchainContext(setup, target);
  const fragment = await toolchain.vite("browser", context);
  const config = mergeConfig(
    {
      root: setup.root,
      plugins: await unpluginOf(target),
      // The testing API's own browser dependencies (CommonJS axe-core, parse5), listed up front:
      // one discovered mid-run reloads the page.
      optimizeDeps: {
        include: ["@unframework.dev/testing > axe-core", "@unframework.dev/testing > parse5"],
      },
    },
    fragment,
  );
  return {
    ...config,
    extends: false,
    test: projectTest(
      target,
      fragment.test,
      {
        testTimeout: TEST_TIMEOUT,
        // A locator that never matches fails in seconds, and a test without an assertion fails L8.
        expect: { poll: { timeout: 5_000 }, requireAssertions: true },
      },
      {
        name,
        root: setup.root,
        include: setup.cases.map((info) => info.spec),
        exclude: [...EXCLUDED],
        setupFiles: [
          resolveModule("@unframework.dev/testing/setup"),
          resolveModule(`@unframework.dev/testing/${target}`),
        ],
        provide: {
          target,
          ufHarness: setup.harness,
          ufCapabilities: builtinTargets[target].capabilities,
          ufNoOutput: {},
        },
        sequence: { groupOrder: group(setup, "browser", target) },
        browser: {
          ...parityBrowser({
            name,
            commands: { ...toolchain.browserCommands?.(context), ufMapStack },
          }),
          // Vitest's failure screenshots go next to the test by default, among the expectations.
          screenshotDirectory: join(setup.root, ".reports", "failures"),
        },
      },
    ),
  } as UserWorkspaceConfig;
}

async function ssrProject(setup: ProjectSetup, target: TargetName): Promise<UserWorkspaceConfig> {
  const toolchain = await loadToolchain(target);
  const fragment = await toolchain.vite("ssr", toolchainContext(setup, target));
  const config = mergeConfig({ root: setup.root, plugins: await unpluginOf(target) }, fragment);
  const cases = setup.cases.map((info): SsrCase => ({
    id: info.id,
    dir: info.dir,
    source: info.source,
  }));
  return {
    ...config,
    extends: false,
    test: projectTest(
      target,
      fragment.test,
      { environment: "node", pool: "forks", testTimeout: TEST_TIMEOUT },
      {
        name: `ssr:${target}`,
        root: setup.root,
        // The spec ships in this package, so it lies in `node_modules` in a project: by its
        // resolved path, and with no exclusion, or Vitest's default drops it.
        include: [resolveModule("@unframework.dev/testing/ssr/spec")],
        exclude: [],
        provide: {
          target,
          ufHarness: setup.harness,
          ufServer: toolchain.server,
          ufSsrCases: cases,
        },
        sequence: { groupOrder: group(setup, "ssr", target) },
      },
    ),
  } as UserWorkspaceConfig;
}
