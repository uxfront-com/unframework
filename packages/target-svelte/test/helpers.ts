import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { formatOutput } from "@unframework/codegen";
import type { EmitContext, OutputFile } from "@unframework/codegen";
import type { UfModule } from "@unframework/ir";

// The analyzer is no dependency of a target (plan §5.2): tests reach it from its source, as the
// render-parity kit does, to lower source snippets as `compile()` would.
import { analyze } from "../../analyzer/src/index.ts";
import { parseModule } from "../../parser/src/index.ts";
import target from "../src/index.ts";

export const packageDir: string = fileURLToPath(new URL("..", import.meta.url));
export const repoRoot: string = join(packageDir, "../..");
export const casesDir: string = join(repoRoot, "tests/integration/cases");
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

/** Each corpus case's IR snapshot, with the directory its golden outputs live in. */
export function corpus(): { name: string; module: UfModule; outputDir: string }[] {
  return filesUnder(casesDir)
    .filter((path) => path.endsWith("/__output__/ir.json"))
    .map((path) => ({
      name: path.slice(casesDir.length + 1, -"/__output__/ir.json".length),
      module: JSON.parse(readFileSync(path, "utf8")) as UfModule,
      outputDir: join(path, "../svelte"),
    }));
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
 * `svelte` like the package itself does. {@link removeScratch} deletes it.
 */
export function scratchDir(): string {
  mkdirSync(join(packageDir, ".uf-tmp"), { recursive: true });
  const directory = mkdtempSync(join(packageDir, ".uf-tmp", "test-"));
  scratch.push(directory);
  return directory;
}

/** Deletes every scratch directory this test file created. */
export function removeScratch(): void {
  for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true });
}

/** Writes files into a fresh scratch directory and returns their absolute paths by name. */
export function writeScratch(files: Record<string, string>): Record<string, string> {
  const directory = scratchDir();
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
