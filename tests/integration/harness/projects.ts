// The Vitest projects of the harness (plan §7.3, DESIGN §4.4):
//
//   compile             node     L1 L2   every case to every target, against __output__
//   harness             node             the harness's own unit tests
//   toolchain:<target>  node     L3 L4   the framework compiler and checker, one run per target
//   ssr:<target>        node     L6 L13  the target's server renderer, through the unplugin
//   browser:<target>    chromium L7 L10 L11 L13  the shared specs, through the unplugin (and L8,
//                                                recorded before it is live: ADR-0043)
//
// Every project sets `extends: false`: inheriting the root config merges its plugins into each
// project (the browser-projects ADR), and a project must hold its own toolchain only. Toolchains
// and the unplugin load inside each ssr and browser project's factory, so one that cannot load
// fails its own projects, loudly, through `harness/unavailable.test.ts`.
import { fileURLToPath } from "node:url";

import type { Toolchain, ToolchainContext } from "@unframework/codegen";
import { formatError, groupOrder, parityBrowser } from "@unframework/testing/node";
import type {
  HarnessContext,
  HarnessMode,
  LayerName,
  ProjectKind,
} from "@unframework/testing/node";
import type { UnframeworkOptions } from "@unframework/unplugin/vite";
import type { Plugin } from "vite";
import { mergeConfig } from "vitest/config";
import type { TestProjectConfiguration, UserWorkspaceConfig, ViteUserConfig } from "vitest/config";

import { canaryPlugins, guardsGoldens } from "./canaries.ts";
import "./context.ts";
import { goldenGuard } from "./guard.ts";
import { FAILURE_SCREENSHOTS_DIR, ROOT, toolchainDir } from "./paths.ts";
import { loadToolchain, REFERENCE } from "./targets.ts";

/** What every project factory needs. */
export interface HarnessSetup {
  harness: HarnessContext;
  mode: HarnessMode;
  targets: readonly string[];
  /** `--project` patterns from the command line; unselected projects load no toolchain. */
  projectFilter?: readonly string[] | undefined;
}

/** What every node project runs with, unless its toolchain needs otherwise. */
const NODE_TEST = { environment: "node", pool: "forks", testTimeout: 60_000 } as const;

/** The layers each kind of project records, which an unavailable project fails. */
const LAYERS_OF: Record<"ssr" | "browser", LayerName[]> = {
  ssr: ["L6", "L13"],
  browser: ["L7", "L10", "L11", "L13"],
};

/** The name of every project, in order: what a run of all of them covers. */
export function projectNames(targets: readonly string[]): string[] {
  return [
    "compile",
    "harness",
    ...targets.map((target) => `toolchain:${target}`),
    ...targets.map((target) => `ssr:${target}`),
    ...targets.map((target) => `browser:${target}`),
  ];
}

/** Every project of the harness. */
export function harnessProjects(setup: HarnessSetup): TestProjectConfiguration[] {
  return [
    nodeProject(setup, "compile", "compile", undefined, ["harness/compile.test.ts"]),
    nodeProject(setup, "harness", "harness", undefined, ["harness/*.unit.test.ts"]),
    ...setup.targets.map((target) =>
      nodeProject(
        setup,
        `toolchain:${target}`,
        "toolchain",
        target,
        ["harness/toolchain.test.ts"],
        {
          // One framework compile and one checker run over the whole corpus, in beforeAll.
          hookTimeout: 300_000,
        },
      ),
    ),
    ...setup.targets.map((target) => lazyProject(setup, "ssr", target, ssrProject)),
    ...setup.targets.map((target) => lazyProject(setup, "browser", target, browserProject)),
  ];
}

function nodeProject(
  setup: HarnessSetup,
  name: string,
  kind: ProjectKind,
  target: string | undefined,
  include: string[],
  test: UserWorkspaceConfig["test"] = {},
): UserWorkspaceConfig & { extends: false } {
  return {
    extends: false,
    test: {
      ...NODE_TEST,
      name,
      root: ROOT,
      include,
      provide: { ...(target ? { target } : {}), ufHarness: setup.harness },
      sequence: { groupOrder: groupOrder(kind, target, setup.mode, REFERENCE) },
      ...test,
    },
  };
}

type ProjectFactory = (
  setup: HarnessSetup,
  target: string,
  toolchain: Toolchain,
  unframework: (options: UnframeworkOptions) => Plugin[],
) => Promise<UserWorkspaceConfig>;

/**
 * A project whose configuration needs the target's toolchain and the unplugin. When either
 * cannot load, the project still exists, under the same name, and fails every test it owes
 * with the reason.
 */
function lazyProject(
  setup: HarnessSetup,
  kind: "ssr" | "browser",
  target: string,
  factory: ProjectFactory,
): () => Promise<UserWorkspaceConfig> {
  const name = `${kind}:${target}`;
  return async () => {
    if (!isSelected(name, setup.projectFilter)) {
      // Not selected with --project: Vitest drops it, so its toolchain need not load.
      return { extends: false, test: { name, root: ROOT, include: [] } } as UserWorkspaceConfig;
    }
    try {
      const [toolchain, unplugin] = await Promise.all([
        loadToolchain(target),
        import("@unframework/unplugin/vite"),
      ]);
      return await factory(setup, target, toolchain, unplugin.default);
    } catch (error) {
      const project = nodeProject(setup, name, kind, target, ["harness/unavailable.test.ts"]);
      project.test!.provide = {
        target,
        ufHarness: setup.harness,
        ufUnavailable: { project: name, layers: LAYERS_OF[kind], message: describeError(error) },
      };
      return project;
    }
  };
}

/** The compile options every ssr and browser project gives the unplugin. */
function unpluginOptions(setup: HarnessSetup, target: string): UnframeworkOptions {
  return {
    target: target as UnframeworkOptions["target"],
    // Off under a canary that changes the output on purpose, unless it is the guard's own.
    ...(guardsGoldens(setup.mode.canary) ? { onCompile: (event) => goldenGuard(event) } : {}),
    plugins: canaryPlugins(setup.mode.canary, target),
  };
}

const ssrProject: ProjectFactory = async (setup, target, toolchain, unframework) => {
  const context: ToolchainContext = { toolchainDir: toolchainDir(target), root: ROOT };
  const fragment = await toolchain.vite("ssr", context);
  const config = mergeConfig(
    { root: ROOT, plugins: unframework(unpluginOptions(setup, target)) },
    fragment,
  );
  return {
    ...config,
    extends: false,
    test: projectTest(target, fragment.test, NODE_TEST, {
      name: `ssr:${target}`,
      root: ROOT,
      include: ["harness/ssr.test.ts"],
      provide: { target, ufHarness: setup.harness, ufServer: toolchain.server },
      sequence: { groupOrder: groupOrder("ssr", target, setup.mode, REFERENCE) },
    }),
  } as UserWorkspaceConfig;
};

const browserProject: ProjectFactory = async (setup, target, toolchain, unframework) => {
  const name = `browser:${target}`;
  const context: ToolchainContext = { toolchainDir: toolchainDir(target), root: ROOT };
  const fragment = await toolchain.vite("browser", context);
  const config = mergeConfig(
    {
      root: ROOT,
      plugins: unframework(unpluginOptions(setup, target)),
      // The testing API's own browser dependencies (CommonJS axe-core, parse5): listed up front,
      // because one discovered mid-run reloads the page (the browser-projects ADR).
      optimizeDeps: {
        include: ["@unframework/testing > axe-core", "@unframework/testing > parse5"],
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
        testTimeout: 60_000,
        expect: {
          // A locator that never matches fails in seconds, not at the test timeout.
          poll: { timeout: 5_000 },
          // A test without an assertion fails L8: every spec asserts what it rendered (ADR-0043).
          requireAssertions: true,
        },
      },
      {
        name,
        root: ROOT,
        include: ["cases/**/*.test.ts"],
        setupFiles: [
          resolveModule("@unframework/testing/setup"),
          resolveModule(`@unframework/testing/${target}`),
        ],
        provide: { target, ufHarness: setup.harness },
        sequence: { groupOrder: groupOrder("browser", target, setup.mode, REFERENCE) },
        browser: {
          ...parityBrowser({ name, commands: toolchain.browserCommands?.(context) ?? {} }),
          // Vitest's failure screenshots go next to the spec by default, among the committed
          // baselines, where the compile project would report them as stale artefacts.
          screenshotDirectory: FAILURE_SCREENSHOTS_DIR,
        },
      },
    ),
  } as UserWorkspaceConfig;
};

type ProjectTest = NonNullable<UserWorkspaceConfig["test"]>;

/**
 * An ssr or browser project's `test` options: the harness's defaults, then the toolchain's own
 * (a pool, a setup file), then the options the harness owns. A toolchain that sets an owned
 * option would silently lose it, so that throws. Setup files add up: the harness's run first.
 */
export function projectTest(
  target: string,
  fragment: ViteUserConfig["test"],
  defaults: ProjectTest,
  owned: ProjectTest,
): ProjectTest {
  const toolchain = (fragment ?? {}) as ProjectTest;
  const taken = Object.keys(toolchain).filter((key) => key !== "setupFiles" && key in owned);
  if (taken.length) {
    throw new Error(
      `The ${target} toolchain's Vite configuration sets ${taken.map((key) => `test.${key}`).join(", ")}, which the harness owns in its projects.`,
    );
  }
  const setupFiles = [owned.setupFiles ?? [], toolchain.setupFiles ?? []].flat();
  return {
    ...defaults,
    ...toolchain,
    ...owned,
    ...(setupFiles.length ? { setupFiles } : {}),
  };
}

function resolveModule(specifier: string): string {
  return fileURLToPath(import.meta.resolve(specifier));
}

/**
 * Whether `--project` selects a project, with Vitest's wildcards (`*`) and negations (`!`).
 * Without patterns every project is selected.
 */
export function isSelected(name: string, patterns: readonly string[] | undefined): boolean {
  if (!patterns?.length) return true;
  if (
    patterns.some((pattern) => pattern.startsWith("!") && toRegExp(pattern.slice(1)).test(name))
  ) {
    return false;
  }
  const positives = patterns.filter((pattern) => !pattern.startsWith("!"));
  return !positives.length || positives.some((pattern) => toRegExp(pattern).test(name));
}

/** A `--project` pattern as Vitest matches it (`wildcardPatternToRegExp`): case-insensitive. */
function toRegExp(pattern: string): RegExp {
  const parts = pattern.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^${parts.join(".*")}$`, "i");
}

/** The `--project` (`-p`) patterns of a Vitest command line, in each spelling Vitest accepts. */
export function projectPatterns(argv: readonly string[]): string[] {
  const patterns: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const option = /^(?:--project|-p)(?:=(.*))?$/s.exec(argv[index]!);
    if (!option) continue;
    if (option[1] !== undefined) patterns.push(option[1]);
    else if (argv[index + 1] !== undefined) patterns.push(argv[(index += 1)]!);
  }
  return patterns;
}

/** An error and its causes, for a test report. */
function describeError(error: unknown): string {
  const lines = [formatError(error)];
  let cause = error instanceof Error ? error.cause : undefined;
  while (cause !== undefined) {
    lines.push(
      `caused by: ${cause instanceof Error ? (cause.stack ?? cause.message) : formatError(cause)}`,
    );
    cause = cause instanceof Error ? cause.cause : undefined;
  }
  return lines.join("\n");
}
