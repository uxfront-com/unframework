// The Vitest projects of the harness (plan §7.3):
//
//   compile             node     L1 L2     every case to every target, against __output__
//   harness             node               the harness's own unit tests
//   toolchain:<target>  node     L3 L4 L5  the framework compiler, checker and linters, one run
//                                          of each per target
//   ssr:<target>        node     L6 L13    the target's server renderer, through the unplugin
//   browser:<target>    chromium L7 L8 L9 L10 L11 L13  the shared specs, through the unplugin
//
// Every project sets `extends: false`: inheriting the root config merges its plugins into each
// project (the browser-projects ADR), and a project must hold its own toolchain only. Toolchains
// and the unplugin load inside each ssr and browser project's factory, so one that cannot load
// fails its own projects, loudly, through `harness/unavailable.test.ts`.
import { fileURLToPath } from "node:url";

import type { Toolchain, ToolchainContext } from "@unframework/codegen";
import { builtinTargets } from "@unframework/compiler";
import type { TargetName } from "@unframework/compiler";
import {
  caseReferences,
  formatError,
  groupOrder,
  parityBrowser,
  recordCompiledModule,
} from "@unframework/testing/node";
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
import { listCases } from "./cases.ts";
import { goldenGuard } from "./guard.ts";
import { noOutputCases, noOutputPlugin } from "./no-output.ts";
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
  browser: ["L7", "L8", "L9", "L10", "L11", "L13"],
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
      sequence: {
        groupOrder: groupOrder(kind, target, setup.mode, REFERENCE, caseReferences(setup.harness)),
      },
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

/**
 * The compile options every ssr and browser project gives the unplugin. Every compile is
 * recorded, so a mount listens to the events the module it compiled declares (the testing API's
 * `ufComponentEvents`), not those of a committed IR an update run has not written yet or a
 * canary changed (ADR-0050); then the golden guard judges it, except under a canary that
 * changes the output on purpose, unless it is the guard's own.
 */
function unpluginOptions(setup: HarnessSetup, target: string): UnframeworkOptions {
  const guard = guardsGoldens(setup.mode.canary);
  return {
    target: target as UnframeworkOptions["target"],
    onCompile: (event) => {
      recordCompiledModule(event);
      return guard ? goldenGuard(event) : undefined;
    },
    plugins: canaryPlugins(
      setup.mode.canary,
      target,
      Object.fromEntries(
        Object.entries(setup.harness.cases).flatMap(([id, config]) =>
          config.reference ? [[id, config.reference]] : [],
        ),
      ),
    ),
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
      sequence: {
        groupOrder: groupOrder("ssr", target, setup.mode, REFERENCE, caseReferences(setup.harness)),
      },
    }),
  } as UserWorkspaceConfig;
};

const browserProject: ProjectFactory = async (setup, target, toolchain, unframework) => {
  const name = `browser:${target}`;
  const context: ToolchainContext = { toolchainDir: toolchainDir(target), root: ROOT };
  const fragment = await toolchain.vite("browser", context);
  // The cases this target has no output for: their specs load against a stand-in, so each test
  // is skipped by the capability it requires (harness/no-output.ts).
  const cases = listCases(setup.harness.casesDir);
  const noOutput = noOutputCases(cases, target);
  const config = mergeConfig(
    {
      root: ROOT,
      plugins: [
        noOutputPlugin(cases, noOutput),
        noErrorBroadcast(),
        ...unframework(unpluginOptions(setup, target)),
      ],
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
          // A locator that never matches fails in seconds, not at the test timeout. The testing
          // setup gives `expect.element` this timeout too: Vitest 5 does not (element-timeout.ts).
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
        // The target's capability matrix as plain data: the browser skips a test that requires
        // a capability the target lacks, and imports no target (ADR-0050). A test of a case the
        // target has no output for that is not skipped so fails, with the expected errors.
        provide: {
          target,
          ufHarness: setup.harness,
          ufCapabilities: builtinTargets[target as TargetName].capabilities,
          ufNoOutput: noOutput,
        },
        sequence: {
          groupOrder: groupOrder(
            "browser",
            target,
            setup.mode,
            REFERENCE,
            caseReferences(setup.harness),
          ),
        },
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

/**
 * Keeps a module that fails to compile from failing the specs after it. Its import fails its own
 * spec, and Vite logs the error; Vite also sends it to every page the server serves, whose client
 * puts an overlay over the page that every later spec of the run clicks in, so cases that compile
 * would time out. `server.hmr.overlay: false` cannot stop it: Vitest sets `server.hmr: false`, and
 * Vite reads `overlay` only from an object, so the overlay stays on. With the overlay off, the
 * client would log the error in whatever test runs instead, and fail that test's L13.
 */
export function noErrorBroadcast(): Plugin {
  return {
    name: "uf-harness:no-error-broadcast",
    configureServer(server) {
      const hot = server.environments.client.hot;
      const send = hot.send.bind(hot);
      hot.send = (...args: unknown[]) => {
        const [payload] = args;
        if (typeof payload === "object" && payload !== null && "type" in payload) {
          if (payload.type === "error") return;
        }
        Reflect.apply(send, undefined, args);
      };
    },
  };
}

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
