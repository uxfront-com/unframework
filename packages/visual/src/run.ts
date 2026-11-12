// The visual run (plan §8.6, ADR-0087): every example on every target, through the browser projects
// `defineTestConfig` builds for the project's own tests (ADR-0086). Each example gets a generated
// case under `.unframework/specs/`, a spec that mounts it and a `case.json` that names it as the
// case's main source, so the setup file, the mount and L10's capture see an ordinary case. The run
// then writes `<out>/report.json` from what `ufExampleCapture` recorded, and `report.html` beside it.
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Diagnostic, TargetName } from "@unframework.dev/compiler";
import { defineTestConfig } from "@unframework.dev/testing/config";
import { BASELINE_ENVIRONMENT } from "@unframework.dev/testing/node";
import type { HarnessContext } from "@unframework.dev/testing/node";
import type { UserWorkspaceConfig, ViteUserConfig } from "vitest/config";
import { startVitest } from "vitest/node";
import type { TestModule } from "vitest/node";

import { takeCaptures, ufExampleCapture } from "./command.ts";
import type { VisualContext } from "./command.ts";
import { checkExamples, discoverExamples } from "./examples.ts";
import type { Example } from "./examples.ts";
import { renderReport } from "./report-page.ts";
import { buildReport, cellKey, formatReport, posixRelative } from "./report.ts";
import type { VisualReport } from "./report.ts";

/** The run directory, relative to the project's root, unless `--out` names another. */
export const DEFAULT_OUT = ".unframework/visual";

/** Where the generated specs go, relative to the root: a case each, and never in the run directory. */
export const SPECS_DIR = ".unframework/specs";

/** A file that marks a directory as a run directory, which a later run may empty. */
export const RUN_MARKER = ".unframework-visual";

/** The options of {@link runVisual}. */
export interface VisualRunOptions {
  /** The project's root, where `unframework.config.ts` lies. */
  root: string;
  /** The targets to run: every one of the project's by default. The reference always joins. */
  targets?: readonly TargetName[];
  /** `live` (the default) or `baseline`. */
  pixels?: "live" | "baseline";
  /** Write the baselines: baseline pixels only, and only in the baseline environment. */
  update?: boolean;
  /** The run directory, absolute or relative to the root: `.unframework/visual` by default. */
  out?: string;
  /** The environment the run reads `CI` and `UF_BASELINE_ENVIRONMENT` from: `process.env`. */
  env?: Readonly<Record<string, string | undefined>>;
  /** Where the run prints a line per example, then the report's path. */
  stdout?: (text: string) => void;
}

/** What a run did. */
export interface VisualRunResult {
  /** 0 when every cell passed, 1 when one failed or an example declares props (UF7011). */
  exitCode: number;
  /** The report, which the run also wrote; absent when UF7011 stopped it before it started. */
  report?: VisualReport;
  /** `<out>/report.json` (absolute), or the diagnostics UF7011 reported. */
  reportPath?: string;
  /** UF7011 for each example that declares props. */
  diagnostics: Diagnostic[];
}

/** A usage or configuration error: the CLI exits 2 with its message. */
export class VisualUsageError extends Error {
  override name = "VisualUsageError";
}

/**
 * Runs every example on every target and writes the report. Throws a {@link VisualUsageError} on
 * options that cannot apply (`--update` with live pixels, or outside the baseline environment, a
 * run directory that is not one), and an error on a configuration that cannot start (no example,
 * an invalid `unframework.config.ts`).
 */
export async function runVisual(options: VisualRunOptions): Promise<VisualRunResult> {
  const root = resolve(options.root);
  const env = options.env ?? process.env;
  const pixels = options.pixels ?? (options.update ? "baseline" : "live");
  const update = options.update ?? false;
  const print = options.stdout ?? ((text: string) => process.stdout.write(text));
  if (update && pixels === "live") {
    throw new VisualUsageError(
      "--update writes the committed baselines, which live pixels never read: drop --live.",
    );
  }
  const environment = env.UF_BASELINE_ENVIRONMENT?.trim() || null;
  if (update && environment !== BASELINE_ENVIRONMENT) {
    throw new VisualUsageError(
      `--update writes the committed Linux baselines, which only ${BASELINE_ENVIRONMENT} writes (UF_BASELINE_ENVIRONMENT); this run is ${environment ?? "outside it"}. Compare live, or run it in that image.`,
    );
  }
  const out = resolve(root, options.out ?? DEFAULT_OUT);
  checkRunDirectory(root, out);

  const examples = discoverExamples({ root, skip: [out] });
  if (!examples.length) {
    throw new VisualUsageError(
      `No example under ${root}: an example is a *.example.uf.tsx file with a component that takes no props, such as examples/Buttons.example.uf.tsx.`,
    );
  }
  const compileErrors = new Map<string, Diagnostic[]>();
  const diagnostics = await checkExamples(root, examples, compileErrors);
  if (diagnostics.some((each) => each.severity === "error")) {
    return { exitCode: 1, diagnostics };
  }

  const specs = writeSpecs(root, examples);

  const saved = {
    targets: process.env.UF_TARGETS,
    update: process.env.UF_UPDATE,
    cli: process.env.UF_TEST_CLI,
  };
  const exitCode = process.exitCode;
  if (options.targets?.length) process.env.UF_TARGETS = options.targets.join(",");
  else delete process.env.UF_TARGETS;
  if (update) process.env.UF_UPDATE = "1";
  else delete process.env.UF_UPDATE;
  // The command line is the CLI's: defineTestConfig must not read Vitest's `--update` from it.
  process.env.UF_TEST_CLI = "1";
  try {
    const config = await visualConfig(root, out, examples, specs, pixels);
    const harness = config.harness;
    // Emptied once the configuration loaded: a run that cannot start keeps the last report.
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, RUN_MARKER), "");
    process.exitCode = 0;
    const vitest = await startVitest(
      [],
      { root, run: true, watch: false, config: false, reporters: [], passWithNoTests: false },
      config.vite,
    );
    const errors = testErrors(vitest.state.getTestModules(), specs);
    // The browser sees only that the import failed: the compile's own errors say why.
    for (const [example, failed] of compileErrors) {
      for (const target of config.targets) {
        const key = cellKey(example, target);
        const known = errors.get(key);
        if (known === undefined) continue;
        const lines = failed.map((each) => `${each.code}: ${each.message}`);
        errors.set(key, [...lines, known].join("\n"));
      }
    }
    const unhandled = vitest.state.getUnhandledErrors();
    await vitest.close();
    const report = buildReport({
      root,
      out,
      pixels,
      update,
      reference: harness.reference,
      targets: config.targets,
      examples,
      captures: takeCaptures(harness.runId),
      errors,
    });
    const reportPath = join(out, "report.json");
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    // The page to browse it, beside it, so its relative image paths hold (plan §8.6).
    writeFileSync(join(out, "report.html"), renderReport(report));
    for (const line of formatReport(report)) print(`${line}\n`);
    for (const error of unhandled)
      print(`unhandled error: ${String((error as Error)?.message ?? error)}\n`);
    print(`report: ${relative(process.cwd(), reportPath) || reportPath}\n`);
    return {
      exitCode: report.passed && !unhandled.length ? 0 : 1,
      report,
      reportPath,
      diagnostics,
    };
  } finally {
    process.exitCode = exitCode;
    restore("UF_TARGETS", saved.targets);
    restore("UF_UPDATE", saved.update);
    restore("UF_TEST_CLI", saved.cli);
  }
}
/**
 * Refuses a run directory the run could not safely empty: the root itself, a directory above it,
 * one that holds the generated specs or lies among them, or an existing directory with files that
 * no earlier run marked as its own.
 */
export function checkRunDirectory(root: string, out: string): void {
  if (contains(out, root)) {
    throw new VisualUsageError(
      `--out ${out} holds the project: the run empties its directory, so name one of its own, such as ${DEFAULT_OUT}.`,
    );
  }
  const specs = join(root, SPECS_DIR);
  if (contains(out, specs) || contains(specs, out)) {
    throw new VisualUsageError(
      `--out ${out} overlaps ${SPECS_DIR}, where the run writes its specs before it empties the run directory: name another, such as ${DEFAULT_OUT}.`,
    );
  }
  if (!existsSync(out)) return;
  const entries = readdirSync(out);
  if (entries.length && !entries.includes(RUN_MARKER)) {
    throw new VisualUsageError(
      `--out ${out} is not empty and no earlier run wrote it: the run empties its directory, so name a new one.`,
    );
  }
}

/** Whether `path` is `directory` or lies inside it. */
function contains(directory: string, path: string): boolean {
  const rel = relative(directory, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/** The generated cases, by example id: each spec's file (absolute). */
type Specs = ReadonlyMap<string, string>;

/**
 * Writes one case per example under `.unframework/specs/`, after removing the last run's: a spec
 * that captures the example, and a `case.json` whose `main` is the example (ADR-0086).
 */
export function writeSpecs(root: string, examples: readonly Example[]): Specs {
  const directory = join(root, SPECS_DIR);
  rmSync(directory, { recursive: true, force: true });
  const browser = fileURLToPath(import.meta.resolve("@unframework.dev/visual/browser"));
  const specs = new Map<string, string>();
  for (const example of examples) {
    const caseDir = join(directory, ...example.id.split("/"));
    mkdirSync(caseDir, { recursive: true });
    const main = posixRelative(caseDir, example.file);
    const spec = join(caseDir, "visual.test.ts");
    const caseId = posixRelative(root, caseDir);
    writeFileSync(join(caseDir, "case.json"), `${JSON.stringify({ main }, null, 2)}\n`);
    writeFileSync(
      spec,
      [
        "// Generated by unframework visual: one example, captured on every target.",
        `import { captureExample } from ${JSON.stringify(specifier(caseDir, browser))};`,
        "",
        `import Example from ${JSON.stringify(specifier(caseDir, example.file))};`,
        "",
        `captureExample(${JSON.stringify(example.id)}, ${JSON.stringify(caseId)}, Example);`,
        "",
      ].join("\n"),
    );
    specs.set(example.id, spec);
  }
  return specs;
}

/** A relative import specifier from a directory to a file. */
function specifier(from: string, file: string): string {
  const path = posixRelative(from, file);
  return path.startsWith(".") ? path : `./${path}`;
}

/** The browser projects of the project's test configuration, aimed at the generated cases. */
async function visualConfig(
  root: string,
  out: string,
  examples: readonly Example[],
  specs: Specs,
  pixels: "live" | "baseline",
): Promise<{ vite: ViteUserConfig; harness: HarnessContext; targets: TargetName[] }> {
  const config = await defineTestConfig({
    root,
    pixels,
    include: [...specs.values()].map((spec) => posixRelative(root, spec)),
  });
  const visual: VisualContext = {
    out,
    examples: Object.fromEntries(
      examples.map((example) => [example.id, { file: example.file, name: example.name }]),
    ),
  };
  const projects = (config.test?.projects ?? []) as UserWorkspaceConfig[];
  const browsers = projects
    .filter((project) => nameOf(project).startsWith("browser:"))
    .map((project): UserWorkspaceConfig => {
      const test = project.test!;
      const browser = test.browser!;
      return {
        ...project,
        // Installed, the package must not be pre-bundled, as the testing package is not
        // (ADR-0086): its copy of the testing API would carry a second Vitest runner.
        optimizeDeps: {
          ...project.optimizeDeps,
          exclude: [...(project.optimizeDeps?.exclude ?? []), "@unframework.dev/visual"],
        },
        test: {
          ...test,
          provide: { ...test.provide, ufVisual: visual },
          browser: {
            ...browser,
            commands: { ...browser.commands, ufExampleCapture } as typeof browser.commands,
          },
        },
      };
    });
  const first = browsers[0]?.test?.provide as { ufHarness?: HarnessContext } | undefined;
  if (!first?.ufHarness) throw new Error("[uf:visual] defineTestConfig built no browser project.");
  // defineTestConfig builds the projects in the project's order of targets.
  const targets = browsers.map((project) => nameOf(project).slice("browser:".length) as TargetName);
  return { vite: { test: { projects: browsers } }, harness: first.ufHarness, targets };
}

/** A project's name: Vitest also takes a label with a colour. */
function nameOf(project: UserWorkspaceConfig): string {
  const name = project.test?.name;
  return typeof name === "string" ? name : (name?.label ?? "");
}

/**
 * The cells whose spec file or test failed, by `<example> <target>`, with their errors: the setup
 * file judges a test after its capture (L8, L13), so a capture that matched does not mean the
 * cell passed.
 */
export function testErrors(modules: readonly TestModule[], specs: Specs): Map<string, string> {
  const byFile = new Map([...specs].map(([id, spec]) => [resolve(spec), id]));
  const errors = new Map<string, string>();
  for (const module of modules) {
    const example = byFile.get(resolve(module.moduleId));
    if (example === undefined) continue;
    const target = module.project.name.replace(/^browser:/, "");
    const tests = [...module.children.allTests()];
    const failed =
      module.state() === "failed" || tests.some((test) => test.result().state === "failed");
    if (!failed) continue;
    const messages = [
      ...module.errors().map(describeError),
      ...tests.flatMap((test) => (test.result().errors ?? []).map(describeError)),
    ];
    errors.set(
      cellKey(example, target),
      messages.length ? messages.join("\n") : "The example's test failed on this target.",
    );
  }
  return errors;
}

/** An error Vitest reported, with the causes it carries: an import's names the compile error. */
function describeError(error: { message: string; cause?: unknown }): string {
  const lines = [error.message];
  let cause = error.cause as { message?: unknown; cause?: unknown } | undefined;
  for (let depth = 0; cause && depth < 5; depth += 1) {
    if (typeof cause.message === "string" && cause.message) lines.push(cause.message);
    cause = cause.cause as typeof cause;
  }
  return lines.join("\n");
}

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
