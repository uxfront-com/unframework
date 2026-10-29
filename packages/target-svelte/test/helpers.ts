import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { formatOutput } from "@unframework/codegen";
import type { EmitContext, OutputFile } from "@unframework/codegen";
import type { UfModule } from "@unframework/ir";

// The analyzer is no dependency of a target (plan §5.2): tests reach it from its source, as the
// render-parity kit does, to lower source snippets as `compile()` would.
import { analyze } from "../../analyzer/src/index.ts";
import { compile, createFileResolver, createSyntacticOracle } from "../../compiler/src/index.ts";
import { parseModule } from "../../parser/src/index.ts";
import target from "../src/index.ts";

export const packageDir: string = fileURLToPath(new URL("..", import.meta.url));
export const repoRoot: string = join(packageDir, "../..");
export const integrationDir: string = join(repoRoot, "tests/integration");
export const casesDir: string = join(integrationDir, "cases");
/** Where svelte-check is installed, beside the toolchain's tsconfig. */
export const toolchainDir: string = join(repoRoot, "tests/toolchains/svelte");

/** Every file under a directory, recursively, as absolute paths. */
function filesUnder(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .toSorted();
}

/** The committed Svelte golden outputs of the integration corpus. */
export function goldenFiles(): string[] {
  return filesUnder(casesDir).filter((path) => /\/__output__\/svelte\/[^/]+\.svelte$/.test(path));
}

/**
 * The `.ts` modules beside a case's golden Svelte outputs, by file name: the shared modules
 * `compile()` copies into the output tree (ADR-0070), whose types an output imports (ADR-0067).
 */
export function sharedModules(outputDir: string): Record<string, string> {
  let names: string[];
  try {
    names = readdirSync(outputDir).filter((name) => name.endsWith(".ts"));
  } catch {
    return {};
  }
  return Object.fromEntries(
    names.map((name) => [name, readFileSync(join(outputDir, name), "utf8")]),
  );
}

/**
 * Whether a case's committed diagnostics hold an error for this target: then `compile()` emits
 * no Svelte output for it (the harness skips every layer past L2), though its IR snapshot exists.
 */
function hasErrors(caseDir: string): boolean {
  const path = join(caseDir, "__expected__/diagnostics.json");
  let diagnostics: { severity: string; target?: string }[];
  try {
    diagnostics = JSON.parse(readFileSync(path, "utf8")) as typeof diagnostics;
  } catch {
    return false;
  }
  return diagnostics.some(
    ({ severity, target: name }) =>
      severity === "error" && (name === undefined || name === "svelte"),
  );
}

/** An IR snapshot. */
const readModule = (file: string) => JSON.parse(readFileSync(file, "utf8")) as UfModule;

/**
 * Each corpus case's IR snapshots, with the directory its golden outputs live in: the cases the
 * compiler emits a Svelte output for. `module` is the main source's; `modules` holds every
 * source's (ADR-0057), the main one first, whose outputs import each other.
 */
export function corpus(): {
  name: string;
  module: UfModule;
  modules: UfModule[];
  outputDir: string;
}[] {
  return filesUnder(casesDir)
    .filter((path) => path.endsWith("/__output__/ir.json") && !hasErrors(join(path, "../..")))
    .map((path) => {
      const module = readModule(path);
      const others = readdirSync(join(path, ".."))
        .filter((name) => /^ir\.[^.]+\.json$/.test(name))
        .toSorted()
        .map((name) => readModule(join(path, "..", name)));
      return {
        name: path.slice(casesDir.length + 1, -"/__output__/ir.json".length),
        module,
        modules: [module, ...others],
        outputDir: join(path, "../svelte"),
      };
    });
}

/** What this target emits for a module, formatted as the compiler formats it. */
export async function emitFormatted(module: UfModule): Promise<OutputFile[]> {
  const files = module.components.flatMap((component) => target.emit(component, context(module)));
  return Promise.all(
    files.map(async (file) => {
      const outcome = await formatOutput(file);
      if (outcome.error) throw new Error(`${file.path} does not format: ${outcome.error}`);
      return outcome.file;
    }),
  );
}

/**
 * What this target emits for a source's one component, as `compile()` would: analysed, then
 * emitted, then formatted unless `format` is false. Fails on any diagnostic.
 */
export async function emitSource(
  source: string,
  { format = false }: { format?: boolean } = {},
): Promise<OutputFile> {
  const { module, diagnostics } = analyze(parseModule("Source.uf.tsx", source));
  if (!module || diagnostics.length) {
    throw new Error(`the source does not analyse: ${diagnostics.map((d) => d.message).join("; ")}`);
  }
  if (module.components.length !== 1) throw new Error("the source has more than one component");
  const files = format
    ? await emitFormatted(module)
    : target.emit(module.components[0]!, context(module));
  if (files.length !== 1) throw new Error(`expected one file, got ${files.length}`);
  return files[0]!;
}

/**
 * What this target emits for several sources that import each other, as `compile()` does with
 * a file resolver and a file-backed type oracle over them (ADR-0053, ADR-0067): every output file
 * by its name. Fails on any error.
 */
export async function compileSources(
  sources: Record<string, string>,
): Promise<Record<string, string>> {
  const readFile = async (path: string) => sources[path.slice(6)];
  const typeOracle = createSyntacticOracle({ root: "/case", readFile });
  const resolve = createFileResolver({ root: "/case", readFile, typeOracle });
  const files: Record<string, string> = {};
  for (const [filename, source] of Object.entries(sources)) {
    const { diagnostics, outputs } = await compile(source, {
      filename,
      targets: [target],
      resolve,
      typeOracle,
    });
    const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error");
    if (errors.length)
      throw new Error(`${filename}: ${errors.map((each) => each.message).join("; ")}`);
    for (const file of outputs["svelte"] ?? []) files[file.path] = file.contents;
  }
  return files;
}

/** An emit context that fails on any diagnostic: a target never reports from `emit`. */
function context(module: UfModule): EmitContext {
  return {
    module,
    options: undefined,
    report: (diagnostic) => {
      throw new Error(`unexpected diagnostic: ${diagnostic.message}`);
    },
  };
}

const scratch: string[] = [];

/**
 * A fresh directory inside this package (gitignored `.uf-tmp/`), so files written there resolve
 * `svelte` like the package itself does, or inside `parent`. {@link removeScratch} deletes it.
 */
export function scratchDir(parent: string = packageDir): string {
  mkdirSync(join(parent, ".uf-tmp"), { recursive: true });
  const directory = mkdtempSync(join(parent, ".uf-tmp", "test-"));
  scratch.push(directory);
  return directory;
}

/** Deletes every scratch directory this test file created. */
export function removeScratch(): void {
  for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true });
}

/**
 * Writes files into a fresh scratch directory, inside `parent` if given, and returns their
 * absolute paths by name.
 */
export function writeScratch(
  files: Record<string, string>,
  parent?: string,
): Record<string, string> {
  const directory = scratchDir(parent);
  return Object.fromEntries(
    Object.entries(files).map(([name, contents]) => {
      const path = join(directory, name);
      writeFileSync(path, contents);
      return [name, path];
    }),
  );
}

/** Imports an ES module written to a scratch file. */
export async function importScratch<T>(name: string, code: string): Promise<T> {
  const { [name]: path } = writeScratch({ [name]: code });
  return (await import(pathToFileURL(path!).href)) as T;
}
