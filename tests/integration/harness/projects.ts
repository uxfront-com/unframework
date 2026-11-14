// The Vitest projects of the harness (plan §7.3):
//
//   compile             node     L1 L2 L14 every case to every target, against __output__
//   harness             node               the harness's own unit tests
//   toolchain:<target>  node     L3 L4 L5  the framework compiler, checker and linters, one run
//                                          of each per target
//   ssr:<target>        node     L6 L13    the target's server renderer, through the unplugin
//   browser:<target>    chromium L7 L8 L9 L10 L11 L13  the shared specs, through the unplugin
//                       (or UF_BROWSER's engine)
//   hydrate:<target>    chromium L12      the shared specs again, each mount the server's HTML
//                                         hydrated (ADR-0095); every check recorded as L12
//   bench               node     L15       the budgets, only when `--project bench` names it
//
// Every project sets `extends: false`: inheriting the root config merges its plugins into each
// project (the browser-projects ADR), and a project must hold its own toolchain only. Toolchains
// and the unplugin load inside each ssr and browser project's factory, so one that cannot load
// fails its own projects, loudly, through `harness/unavailable.test.ts`.
import { availableParallelism } from "node:os";
import { relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import type { Toolchain, ToolchainContext } from "@unframework.dev/codegen";
import { builtinTargets } from "@unframework.dev/compiler";
import type { TargetName } from "@unframework.dev/compiler";
import {
  caseReferences,
  formatError,
  groupOrder,
  parityBrowser,
  recordCompiledModule,
} from "@unframework.dev/testing/node";
import type {
  HarnessContext,
  HarnessMode,
  LayerName,
  ProjectKind,
} from "@unframework.dev/testing/node";
import type { UnframeworkOptions } from "@unframework.dev/unplugin/vite";
import type { Plugin } from "vite";
import { mergeConfig } from "vitest/config";
import type { TestProjectConfiguration, UserWorkspaceConfig, ViteUserConfig } from "vitest/config";

import { canaryPlugins, canaryServePlugin, findCanary, guardsGoldens } from "./canaries.ts";
import "./context.ts";
import { listCases } from "./cases.ts";
import { ENGINE_DECLARATIONS, enginePlugins } from "./engines.ts";
import { goldenGuard } from "./guard.ts";
import { hydrationRunners, ufHydrationRender } from "./hydrate.ts";
import { noOutputCases, noOutputPlugin, standInCases, standInReasons } from "./no-output.ts";
import { FAILURE_SCREENSHOTS_DIR, ROOT, toolchainDir } from "./paths.ts";
import { SSR_SHARDS, shardFiles } from "./shards.ts";
import { loadToolchain, REFERENCE } from "./targets.ts";
import { ufMapStack } from "./thrown.ts";

/** What every project factory needs. */
export interface HarnessSetup {
  harness: HarnessContext;
  mode: HarnessMode;
  targets: readonly string[];
  /** `--project` patterns from the command line; unselected projects load no toolchain. */
  projectFilter?: readonly string[] | undefined;
  /**
   * The targets some case names as its own reference (ADR-0057), each with those cases: their
   * `ssr:` and `browser:` projects run on those cases alone. A target the run leaves out joins
   * with them, so the other targets have the case's expectations and pixels to compare with.
   */
  referencesOnly?: Readonly<Record<string, readonly string[]>>;
}

/**
 * The targets `targets` leaves out that some case names as its own reference, each with those
 * cases (`HarnessSetup.referencesOnly`). The baseline script's reference pass
 * (`scripts/references.ts`) sets UF_REFERENCE_PASS=1, which keeps every such target to those
 * cases, and leaves the caller's filters and options to Vitest.
 */
export function referencesOnly(
  cases: Readonly<Record<string, { reference?: string }>>,
  targets: readonly string[],
  pass: boolean = process.env.UF_REFERENCE_PASS === "1",
): Record<string, string[]> {
  const only: Record<string, string[]> = {};
  for (const [id, config] of Object.entries(cases)) {
    if (config.reference === undefined || (!pass && targets.includes(config.reference))) continue;
    (only[config.reference] ??= []).push(id);
  }
  return only;
}

/** What every node project runs with, unless its toolchain needs otherwise. */
const NODE_TEST = { environment: "node", pool: "forks", testTimeout: 60_000 } as const;

/** The layers each kind of project records, which an unavailable project fails. */
const LAYERS_OF: Record<"ssr" | "browser" | "hydrate", LayerName[]> = {
  ssr: ["L6", "L13"],
  browser: ["L7", "L8", "L9", "L10", "L11", "L13", "L14"],
  hydrate: ["L12"],
};

/** The budgets' project: left out of a run that does not name it, so `pnpm test` stays short. */
export const BENCH_PROJECT = "bench";

/** The name of every project of the default run, in order: what a run of all of them covers. */
export function projectNames(targets: readonly string[]): string[] {
  return [
    "compile",
    "harness",
    ...targets.map((target) => `toolchain:${target}`),
    ...targets.map((target) => `ssr:${target}`),
    ...targets.map((target) => `browser:${target}`),
    ...targets.map((target) => `hydrate:${target}`),
  ];
}

/** What CI's parity job requires: the default run's projects, and the `Bench` job's. */
export function parityProjects(targets: readonly string[]): string[] {
  return [...projectNames(targets), BENCH_PROJECT];
}

/** Every project of the harness. */
export function harnessProjects(setup: HarnessSetup): TestProjectConfiguration[] {
  return [
    nodeProject(setup, "compile", "compile", undefined, ["harness/compile.test.ts"]),
    nodeProject(setup, "harness", "harness", undefined, ["harness/*.unit.test.ts"]),
    // By its exact name: a wildcard that selects everything still means the default run.
    ...(setup.projectFilter?.includes(BENCH_PROJECT)
      ? [
          nodeProject(setup, BENCH_PROJECT, "bench", undefined, ["harness/bench.test.ts"], {
            // Every timed iteration, then each target's compile and bundle of the corpus.
            hookTimeout: 1_800_000,
          }),
        ]
      : []),
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
    ...setup.targets.map((target) => lazyProject(setup, "hydrate", target, hydrateProject)),
    ...Object.keys(setup.referencesOnly ?? {})
      .filter((target) => !setup.targets.includes(target))
      .flatMap((target) => [
        lazyProject(setup, "ssr", target, ssrProject),
        lazyProject(setup, "browser", target, browserProject),
      ]),
  ];
}

/**
 * Whether a browser project runs its spec files in parallel: in Chromium, yes. In Firefox and
 * WebKit, no (ADR-0081): their tester pages in one browser compete for the focus, so a page
 * idle in one file sees the blur and focus events of another's, and five followers' pages
 * at once ran the nightly's WebKit job out of memory.
 */
export function fileParallelism(mode: Pick<HarnessMode, "browser">): boolean {
  return mode.browser === undefined || mode.browser === "chromium";
}

/**
 * The targets whose spec files each get a fresh page, with the reason (ADR-0092). Every other
 * browser project runs its spec files one after another on each of its pages, which keep their
 * modules: the testing setup and the framework load once per page, not once per file.
 */
export const FRESH_PAGE_PER_FILE: Readonly<Record<string, string>> = {
  vue: "Vue's development build rethrows an error that a lifecycle hook throws out of its post-flush queue, which then never runs again on that page. sourcemaps/mounted-throws throws there on purpose (L14), so no later spec file's mounted hooks would run.",
};

/** A project's `maxWorkers`, when it has its own page count. */
function pagesOption(pages: number | undefined): { maxWorkers?: number } {
  return pages === undefined ? {} : { maxWorkers: pages };
}

/** Whether a target's browser project gives every spec file a fresh page (`isolate`). */
export function isolatesFiles(target: string): boolean {
  return Object.hasOwn(FRESH_PAGE_PER_FILE, target);
}

/** A project of the harness, as `harnessProjects` lists it: what its group depends on. */
export interface ProjectEntry {
  name: string;
  kind: ProjectKind;
  target: string | undefined;
}

/** Every project `harnessProjects` makes, with its kind and target, in the same order. */
export function projectEntries(setup: HarnessSetup): ProjectEntry[] {
  const extra = Object.keys(setup.referencesOnly ?? {}).filter(
    (target) => !setup.targets.includes(target),
  );
  return [
    { name: "compile", kind: "compile", target: undefined },
    { name: "harness", kind: "harness", target: undefined },
    ...(setup.projectFilter?.includes(BENCH_PROJECT)
      ? [{ name: BENCH_PROJECT, kind: "bench" as const, target: undefined }]
      : []),
    ...setup.targets.map((target) => ({
      name: `toolchain:${target}`,
      kind: "toolchain" as const,
      target,
    })),
    ...setup.targets.map((target) => ({ name: `ssr:${target}`, kind: "ssr" as const, target })),
    ...setup.targets.map((target) => ({
      name: `browser:${target}`,
      kind: "browser" as const,
      target,
    })),
    ...setup.targets.map((target) => ({
      name: `hydrate:${target}`,
      kind: "hydrate" as const,
      target,
    })),
    ...extra.flatMap((target) => [
      { name: `ssr:${target}`, kind: "ssr" as const, target },
      { name: `browser:${target}`, kind: "browser" as const, target },
    ]),
  ];
}

/** The tester pages the reference's browser project opens for each CPU, while it runs alone. */
export const REFERENCE_PAGES_PER_CPU = 2;

/**
 * The most tester pages the reference opens: the count measured best, on 14 CPUs (ADR-0092).
 * Vitest caps the followers' default at 12 pages, so without a cap a large machine would give the
 * reference several times the pages the followers have.
 */
export const MAX_REFERENCE_PAGES = 28;

/**
 * How many tester pages the reference's browser project opens, or `undefined` for Vitest's
 * default (ADR-0092). In a live `browser:*` run the reference runs alone, first, and the
 * followers wait for it, so it opens more pages. Its files keep a fresh frame each and mostly wait
 * on the browser, so the CPUs have room. Vitest refuses two projects in one `sequence.groupOrder`
 * group with different `maxWorkers`, so the reference takes them only when no other project the
 * run selects shares its group: not in a full run or in CI's baseline mode. An update run and a
 * `--maxWorkers` the caller gives keep their own.
 */
export function referencePages(
  setup: HarnessSetup,
  cpus: number,
  argv: readonly string[] = process.argv,
  env: Readonly<Record<string, string | undefined>> = process.env,
): number | undefined {
  // An update run writes artefacts, so it keeps the page count it has always had.
  if (setup.mode.update || !fileParallelism(setup.mode)) return undefined;
  if (env.VITEST_MAX_WORKERS !== undefined) return undefined;
  if (argv.some((arg) => /^--max-?workers(=|$)/i.test(arg))) return undefined;
  const selected = projectEntries(setup).filter((entry) =>
    isSelected(entry.name, setup.projectFilter),
  );
  const reference = selected.find(
    (entry) => entry.kind === "browser" && entry.target === REFERENCE,
  );
  if (!reference) return undefined;
  const group = projectGroup(setup, reference.kind, reference.target);
  const shared = selected.some(
    (entry) => entry !== reference && projectGroup(setup, entry.kind, entry.target) === group,
  );
  if (shared) return undefined;
  return Math.min(MAX_REFERENCE_PAGES, Math.max(1, Math.round(cpus * REFERENCE_PAGES_PER_CPU)));
}

/**
 * A project's `sequence.groupOrder`, from every target the run's browser projects cover: the
 * run's targets, then the case references it adds (`referencesOnly`).
 */
export function projectGroup(
  setup: HarnessSetup,
  kind: ProjectKind,
  target: string | undefined,
): number {
  const targets = [
    ...setup.targets,
    ...Object.keys(setup.referencesOnly ?? {}).filter((name) => !setup.targets.includes(name)),
  ];
  return groupOrder(kind, target, setup.mode, REFERENCE, caseReferences(setup.harness), targets);
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
        groupOrder: projectGroup(setup, kind, target),
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
  kind: "ssr" | "browser" | "hydrate",
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
        import("@unframework.dev/unplugin/vite"),
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

/**
 * The plugin of a canary that corrupts the maps of served modules (`Canary.servedMap`), as a list
 * to spread into a project's plugins: empty for every other run.
 */
function servedMapCanary(setup: HarnessSetup, target: string): Plugin[] {
  const plugin = canaryServePlugin(
    setup.mode.canary,
    target,
    setup.harness.casesDir,
    listCases(setup.harness.casesDir),
  );
  return plugin ? [plugin] : [];
}

/**
 * Where a target's toolchain runs the ssr and browser projects: its checkers read the styling
 * engines' virtual modules beside the outputs (ADR-0064), Angular's ngtsc compiles with them,
 * and a server of the toolchain's own (Astro's render server) loads the engines' plugins too.
 */
function toolchainContext(target: string): ToolchainContext {
  return {
    toolchainDir: toolchainDir(target),
    root: ROOT,
    declarations: ENGINE_DECLARATIONS,
    plugins: enginePlugins,
  };
}

/**
 * How many shard files run an ssr project's renders (ADR-0093): the target's `SSR_SHARDS`, or
 * one, and one for a project the run adds as some case's reference, whose few cases a shard
 * file each would leave some files without a test, which fails them.
 */
export function ssrShardCount(setup: Pick<HarnessSetup, "referencesOnly">, target: string): number {
  return setup.referencesOnly?.[target] ? 1 : (SSR_SHARDS[target] ?? 1);
}

const ssrProject: ProjectFactory = async (setup, target, toolchain, unframework) => {
  const shards = ssrShardCount(setup, target);
  const context = toolchainContext(target);
  const fragment = await toolchain.vite("ssr", context);
  const config = mergeConfig(
    {
      root: ROOT,
      // The engines' plugins resolve the imports every output keeps as written (ADR-0064).
      plugins: [
        ...(await enginePlugins()),
        ...unframework(unpluginOptions(setup, target)),
        ...servedMapCanary(setup, target),
      ],
    },
    fragment,
  );
  return {
    ...config,
    extends: false,
    test: projectTest(target, fragment.test, NODE_TEST, {
      name: `ssr:${target}`,
      root: ROOT,
      include: shardFiles("ssr", shards),
      provide: {
        target,
        ufHarness: setup.harness,
        ufServer: toolchain.server,
        ufSsrShards: shards,
        ...(setup.referencesOnly?.[target] ? { ufOnly: [...setup.referencesOnly[target]] } : {}),
      },
      sequence: {
        groupOrder: projectGroup(setup, "ssr", target),
      },
    }),
  } as UserWorkspaceConfig;
};

const browserProject: ProjectFactory = (setup, target, toolchain, unframework) =>
  pageProject("browser", setup, target, toolchain, unframework);

/**
 * A hydrate project (L12, ADR-0095): the browser project's specs and pages, built from the
 * toolchain's `hydrate` Vite configuration, with the render command and the target's hydrate
 * adapter, whose `mount` renders the case's main component on the server and hydrates it. It
 * compares with the shared expectations and writes nothing, and captures no pixels. A target
 * without a hydrate adapter declares `hydration` unsupported: its project loads the specs as its
 * browser project does, and skips every test by that capability.
 */
const hydrateProject: ProjectFactory = (setup, target, toolchain, unframework) =>
  pageProject("hydrate", setup, target, toolchain, unframework);

/** A project whose specs run in a page: a browser or a hydrate project. */
async function pageProject(
  kind: "browser" | "hydrate",
  setup: HarnessSetup,
  target: string,
  toolchain: Toolchain,
  unframework: (options: UnframeworkOptions) => Plugin[],
): Promise<UserWorkspaceConfig> {
  const name = `${kind}:${target}`;
  const context = toolchainContext(target);
  const hydrates = kind === "hydrate" && toolchain.hydrate !== undefined;
  const fragment = await toolchain.vite(hydrates ? "hydrate" : "browser", context);
  // The cases this target has no output for, or cannot compile yet: their specs load against a
  // stand-in, so each test is skipped with the expected errors, or fails every browser layer
  // with the stand-in's cause (harness/no-output.ts).
  const cases = listCases(setup.harness.casesDir);
  const noOutput = noOutputCases(cases, target);
  const standIns = standInCases(cases, target, setup.harness.quarantine);
  const config = mergeConfig(
    {
      root: ROOT,
      plugins: [
        noOutputPlugin(cases, standInReasons(noOutput, standIns)),
        noErrorBroadcast(),
        ...(hydrates ? [ssrExternals(fragment), hydrationRunners()] : []),
        // The engines' plugins resolve the imports every output keeps as written (ADR-0064).
        ...(await enginePlugins()),
        ...pageCompilers(kind, setup, target, unframework),
        ...servedMapCanary(setup, target),
      ],
      // The testing API's own browser dependencies (CommonJS axe-core, parse5), and the runtime
      // Styleframe's recipes import (ADR-0064): listed up front, because one discovered mid-run
      // reloads the page (the browser-projects ADR).
      optimizeDeps: {
        include: [
          "@unframework.dev/testing > axe-core",
          "@unframework.dev/testing > parse5",
          "@styleframe/runtime",
        ],
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
        // A target the run adds as some case's reference runs that case alone.
        include: setup.referencesOnly?.[target]
          ? cases
              .filter((info) => setup.referencesOnly![target]!.includes(info.id) && info.spec)
              .map((info) => relative(ROOT, info.spec!).split(sep).join("/"))
          : ["cases/**/*.test.ts"],
        setupFiles: [
          resolveModule("@unframework.dev/testing/setup"),
          resolveModule(`@unframework.dev/testing/${target}`),
          // After the mount adapter's registration, which the hydrate adapter joins.
          ...(hydrates ? [hydrateSetup(target)] : []),
        ],
        // The target's capability matrix as plain data: the browser skips a test that requires
        // a capability the target lacks, and imports no target (ADR-0050). A test of a case the
        // target has no output for that is not skipped so fails, with the expected errors.
        provide: {
          target,
          ufHarness: setup.harness,
          ufCapabilities: builtinTargets[target as TargetName].capabilities,
          ufNoOutput: noOutput,
          ufStandIn: standIns,
          ...(kind === "hydrate" ? { ufHydrate: true, ufServer: toolchain.server } : {}),
        },
        sequence: { groupOrder: projectGroup(setup, kind, target) },
        // Spec files share a page, but where the target's runtime cannot (ADR-0092).
        isolate: isolatesFiles(target),
        // Outside Chromium, parallel tester pages in one engine take the focus from each other.
        ...(fileParallelism(setup.mode) ? {} : { fileParallelism: false }),
        ...(kind === "browser" && target === REFERENCE
          ? pagesOption(referencePages(setup, availableParallelism()))
          : {}),
        browser: {
          ...parityBrowser({
            name,
            commands: {
              ...toolchain.browserCommands?.(context),
              ufMapStack,
              ...(hydrates ? { ufHydrationRender } : {}),
            },
            browser: setup.mode.browser ?? "chromium",
          }),
          // Vitest's failure screenshots go next to the spec by default, among the committed
          // baselines, where the compile project would report them as stale artefacts.
          screenshotDirectory: FAILURE_SCREENSHOTS_DIR,
        },
      },
    ),
  } as UserWorkspaceConfig;
}

/**
 * The unplugin of a page project. A hydrate project under a canary that corrupts the page alone
 * (`Canary.clientOnly`, L12) runs two: the canary's for the page's environment, and one without it
 * for the server's, where the render command renders. Each instance keeps its own compile, so
 * the server's HTML stays right (ADR-0095).
 */
function pageCompilers(
  kind: "browser" | "hydrate",
  setup: HarnessSetup,
  target: string,
  unframework: (options: UnframeworkOptions) => Plugin[],
): Plugin[] {
  const options = unpluginOptions(setup, target);
  const canary = setup.mode.canary ? findCanary(setup.mode.canary) : undefined;
  if (kind !== "hydrate" || !canary?.clientOnly) return unframework(options);
  return [
    ...onEnvironments(unframework(options), (name) => name === "client"),
    ...onEnvironments(unframework({ ...options, plugins: [] }), (name) => name !== "client"),
  ];
}

/** Plugins that apply to the environments `applies` names alone. */
function onEnvironments(plugins: Plugin[], applies: (name: string) => boolean): Plugin[] {
  return plugins.map((plugin) => ({
    ...plugin,
    applyToEnvironment: (environment) =>
      applies(environment.name) &&
      (plugin.applyToEnvironment ? plugin.applyToEnvironment(environment) : true),
  }));
}

/**
 * The setup file that registers a target's hydrate adapter in its hydrate project, beside this
 * file: the hydrate projects are the harness's own, so their registrations are too.
 */
function hydrateSetup(target: string): string {
  return fileURLToPath(new URL(`./hydrate-setup/${target}.ts`, import.meta.url));
}

/**
 * Keeps the dependencies a toolchain's `hydrate` configuration externalises in its SSR
 * environment (`environments.ssr.resolve.external`) external there, where the hydrate render
 * command renders (ADR-0095). Vitest's own plugin sets that environment's `noExternal` to `true`
 * and its `external` to Node's built-ins after every project plugin's configuration, so every
 * dependency is inlined: Qwik needs that (one copy of its runtime on the server), but a CommonJS
 * package such as react-dom cannot run inlined. An explicit `external` list still wins over
 * `noExternal: true`, so this adds the toolchain's list back, after Vitest's hook.
 */
export function ssrExternals(fragment: ViteUserConfig): Plugin {
  const external = fragment.environments?.ssr?.resolve?.external;
  const names = Array.isArray(external) ? external : [];
  return {
    name: "uf-harness:hydrate-ssr-externals",
    enforce: "post",
    configEnvironment: {
      order: "post",
      handler(name, config) {
        if (name !== "ssr" || !names.length) return;
        const current = config.resolve?.external;
        config.resolve ??= {};
        config.resolve.external = [...(Array.isArray(current) ? current : []), ...names];
      },
    },
  };
}

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
