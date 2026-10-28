import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { formatOutput, scopeStylesheet } from "@unframework/codegen";
import type { EmitContext, OutputFile, ToolchainContext } from "@unframework/codegen";
import { checkInvariants } from "@unframework/ir";
import type { UfModule } from "@unframework/ir";
import type { Plugin, ResolvedConfig } from "vite";

// The analyser is no dependency of a target (plan §5.2): tests reach it from its source, as the
// render-parity kit does, to lower source snippets as `compile()` would rather than hand-build
// IR it would never produce.
import { analyze, stylesheetImports } from "../../analyzer/src/index.ts";
import type { StylesheetSource } from "../../analyzer/src/index.ts";
import { parseModule } from "../../parser/src/index.ts";
import target from "../src/index.ts";
import { ngtscVirtual } from "../src/toolchain/ngtsc-virtual.ts";
import { loadCompiler } from "../src/toolchain/tools.ts";

export const packageDir: string = fileURLToPath(new URL("..", import.meta.url));
export const repoRoot: string = join(packageDir, "../..");
export const casesDir: string = join(repoRoot, "tests/integration/cases");

/** The repo's own setup: the compiler stack in tests/toolchains/angular, run from the corpus. */
export const context: ToolchainContext = {
  toolchainDir: join(repoRoot, "tests/toolchains/angular"),
  root: join(repoRoot, "tests/integration"),
  // The styling engines' modules, which the styled goldens import (ADR-0064).
  declarations: [
    join(repoRoot, "tests/integration/styleframe.d.ts"),
    join(repoRoot, "tests/integration/fixture-engine.d.ts"),
  ],
};

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .toSorted();
}

/** The committed Angular golden outputs of the integration corpus. */
export function goldenFiles(): string[] {
  return filesUnder(casesDir).filter((path) => /\/__output__\/angular\/[^/]+\.ts$/.test(path));
}

/**
 * The corpus's feature cases (not `diagnostics/`, whose sources fail on purpose): each case's
 * name and its component source.
 */
export function corpusSources(): { name: string; file: string; source: string }[] {
  // The checks read the path within the corpus: CI checks the repo out under `/__w/`.
  return filesUnder(casesDir)
    .map((path) => ({ path, file: path.slice(casesDir.length + 1) }))
    .filter(({ file }) => file.endsWith(".uf.tsx") && !file.includes("/__"))
    .map(({ path, file }) => ({
      name: file.slice(0, file.lastIndexOf("/")),
      file,
      source: readFileSync(path, "utf8"),
    }))
    .filter(
      ({ name }) =>
        !name.startsWith("diagnostics/") &&
        !COMPOSITION.test(name) &&
        !STYLED_COMPOSITION.test(name) &&
        !BINDING_COMPOSITION.test(name) &&
        !TYPE_MODULES.test(name),
    );
}

/**
 * The scoping corpus's composition cases: a parent reads its child's API, scope id included,
 * through the resolver `compile()` runs, which `lower` has not. The corpus's toolchain project
 * checks their Angular outputs (ADR-0063).
 */
const STYLED_COMPOSITION =
  /^styles\/(?:child-root|child-root-branches|deep|global|slotted|slotted-order)$/;

/**
 * The binding cases whose main source renders a child that merges a style bound to a value
 * (ADR-0065): they resolve the child as `compile()` does, which `lower` has not. The corpus's
 * toolchain project checks their Angular outputs.
 */
const BINDING_COMPOSITION = /^bindings\/(?:style-expression|style-spread)$/;

/**
 * The types and generics cases whose sources import types from a module beside them, or render
 * a child (ADR-0067, ADR-0068): `compile()` resolves both through its oracle and resolver, and
 * copies the modules into the output tree, which `lower` does not. The corpus's toolchain project
 * checks their Angular outputs.
 */
const TYPE_MODULES = /^types\/|^generics\/(?:scoped-slot|select)$/;

/**
 * The areas of M3's composition cases, which Angular reports (UF1002) until its M3 lane
 * (UXF-318) emits composition: `harness/quarantine/angular.ts` lists them, and the lane brings
 * them back here.
 */
const COMPOSITION =
  /^(?:components|slots|fallthrough|expose|models|context|dynamic)\/|^semantics\/models$/;

/** What this target emits for a module, unformatted, failing on any diagnostic. */
export function emitModule(module: UfModule): OutputFile[] {
  const emitContext: EmitContext = {
    module,
    options: undefined,
    report: (diagnostic) => {
      throw new Error(`unexpected diagnostic: ${diagnostic.message}`);
    },
  };
  return module.components.flatMap((each) => target.emit(each, emitContext));
}

/** What this target emits for a module, formatted as the compiler formats it. */
export async function emitFormatted(module: UfModule): Promise<OutputFile[]> {
  return Promise.all(
    emitModule(module).map(async (file) => {
      const outcome = await formatOutput(file);
      if (outcome.error) throw new Error(`${file.path} does not format: ${outcome.error}`);
      return outcome.file;
    }),
  );
}

/**
 * The IR of a source, as `compile()` lowers it: it must lower without an error, and without a
 * warning unless `warnings` allows them (a corpus case may show one on purpose).
 */
export function lower(source: string, file = "Card.uf.tsx", warnings = false): UfModule {
  const parsed = parseModule(file, source);
  const { module, diagnostics } = analyze(parsed, { stylesheets: caseSheets(parsed, file) });
  const failing = diagnostics.filter(({ severity }) => !warnings || severity === "error");
  if (failing.length || !module) {
    throw new Error(`${file} does not lower cleanly: ${JSON.stringify(diagnostics, null, 2)}`);
  }
  const broken = checkInvariants(module);
  if (broken.length) throw new Error(`${file} lowers invalid IR: ${JSON.stringify(broken)}`);
  return module;
}

/**
 * The stylesheets a corpus source imports, read beside it as the case's resolver reads them
 * (ADR-0063), with whether they use `:slotted()`, which `compile()` asks the codegen scoper.
 * A sheet that is not there is `undefined`, as an unread one is (UF5005).
 */
function caseSheets(
  parsed: ReturnType<typeof parseModule>,
  file: string,
): Map<string, StylesheetSource | undefined> {
  return new Map(
    stylesheetImports(parsed).map((specifier) => {
      const path = join(casesDir, dirname(file), specifier);
      if (!existsSync(path)) return [specifier, undefined];
      const source = readFileSync(path, "utf8");
      return [
        specifier,
        { file: path, source, slotted: scopeStylesheet(path, source, "00000000").slotted },
      ];
    }),
  );
}

/** The one file a single-component source emits, as `emit` prints it (unformatted). */
export function emitted(source: string): string {
  const [file, ...more] = emitModule(lower(source));
  if (!file || more.length) throw new Error("Expected one file.");
  return file.contents;
}

/** The one file a single-component source emits, formatted as the compiler writes it. */
export async function formatted(source: string): Promise<OutputFile> {
  const [file, ...more] = await emitFormatted(lower(source));
  if (!file || more.length) throw new Error("Expected one file.");
  return file;
}

const scratch: string[] = [];

/** A fresh directory inside this package (gitignored `.uf-tmp/`); see {@link removeScratch}. */
export function scratchDir(): string {
  mkdirSync(join(packageDir, ".uf-tmp"), { recursive: true });
  const directory = mkdtempSync(join(packageDir, ".uf-tmp", "test-"));
  scratch.push(directory);
  return directory;
}

/** A fresh directory outside the repository, where no `node_modules` above it can help. */
export function isolatedDir(): string {
  const directory = mkdtempSync(join(tmpdir(), "uf-target-angular-"));
  scratch.push(directory);
  return directory;
}

/** Deletes every scratch directory this test file created. */
export function removeScratch(): void {
  for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true });
}

/** Writes files into a directory and returns their absolute paths by name. */
export function writeFiles(
  directory: string,
  files: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).map(([name, contents]) => {
      const path = join(directory, name);
      writeFileSync(path, contents);
      return [name, path];
    }),
  );
}

/** A standalone Angular component with an inline template, as the target emits them. */
export function component(name: string, template: string, body = ""): string {
  return [
    `import { ${/\binput\b/.test(body) ? "Component, input" : "Component"} } from "@angular/core";`,
    "",
    "@Component({",
    `  selector: "uf-${name.toLowerCase()}",`,
    '  host: { style: "display: contents" },',
    `  template: \`${template}\`,`,
    "})",
    `export default class ${name} {${body}}`,
    "",
  ].join("\n");
}

type TransformHandler = (
  this: {
    environment: { mode: string; config: { consumer: string }; logger: { error(m: string): void } };
    warn(message: string): void;
    error(message: string): never;
    resolve(specifier: string, importer: string): Promise<{ id: string } | null>;
    load(options: { id: string }): Promise<unknown>;
  },
  code: string,
  id: string,
) => Promise<{ code: string; map: string | null }>;

/** The ngtsc plugin under test, with what it warned about and logged. */
export interface NgtscHarness {
  plugin: Plugin;
  warnings: string[];
  logged: string[];
  /** The ids the plugin asked Vite to load (`this.load`), in order. */
  loaded: string[];
  transform: (id: string, code?: string) => Promise<{ code: string; map: string | null }>;
}

/** How the harness's Vite answers the plugin's `this.resolve` and `this.load`. */
export interface NgtscVite {
  /** Resolves a specifier from an importer to a module id, or to nothing (the default). */
  resolve?: (specifier: string, importer: string) => string | undefined;
  /**
   * Serves a module's source only once Vite has loaded it (`this.load`, or the transform of the
   * module itself), as the unframework plugin does; by default it serves every source.
   */
  lazy?: boolean;
  /** Fails each load with this reason, as the unframework plugin fails a module it rejects. */
  loadError?: string;
  /** The scoped sheet the unframework plugin emitted for each `.uf.tsx` file (ADR-0063). */
  sheets?: Record<string, string>;
}

/**
 * The ngtsc plugin, set up as Vite sets it up beside an unframework plugin that serves
 * `sources` (generated Angular code by virtual id), in a dev server's `consumer` environment.
 * `transform` runs its transform hook; `this.load` loads a module and runs the hook on it.
 */
export async function ngtscPlugin(
  sources: Record<string, string> = {},
  consumer: "client" | "server" = "server",
  vite: NgtscVite = {},
): Promise<NgtscHarness> {
  const plugin = ngtscVirtual(await loadCompiler(context.toolchainDir));
  const served = new Set<string>(vite.lazy ? [] : Object.keys(sources));
  const unframework = {
    name: "unframework",
    api: {
      getCompiled: (id: string) => (served.has(id) ? sources[id] : undefined),
      getSheet: (file: string) => vite.sheets?.[file],
    },
  };
  (plugin.configResolved as (config: ResolvedConfig) => void)({
    plugins: [unframework as Plugin, plugin],
  } as unknown as ResolvedConfig);
  const warnings: string[] = [];
  const logged: string[] = [];
  const loaded: string[] = [];
  const { handler } = plugin.transform as { handler: TransformHandler };
  const transform = (id: string, code = sources[id]!) => {
    served.add(id);
    return handler.call(pluginContext, code, id);
  };
  const pluginContext = {
    environment: {
      mode: "dev",
      config: { consumer },
      logger: { error: (message: string) => void logged.push(message) },
    },
    warn: (message: string) => void warnings.push(message),
    error: (message: string): never => {
      throw new Error(message);
    },
    resolve: (specifier: string, importer: string) => {
      const id = vite.resolve?.(specifier, importer);
      return Promise.resolve(id === undefined ? null : { id });
    },
    load: async ({ id }: { id: string }) => {
      loaded.push(id);
      if (vite.loadError !== undefined) throw new Error(vite.loadError);
      return transform(id);
    },
  };
  return { plugin, warnings, logged, loaded, transform };
}
