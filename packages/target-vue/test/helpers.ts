import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { formatOutput } from "@unframework/codegen";
import type { EmitContext, OutputFile } from "@unframework/codegen";
import type { UfModule } from "@unframework/ir";

import target from "../src/index.ts";

export const packageDir: string = fileURLToPath(new URL("..", import.meta.url));
export const repoRoot: string = join(packageDir, "../..");
export const casesDir: string = join(repoRoot, "tests/integration/cases");
/** Where vue-tsc is installed, beside the toolchain's tsconfig. */
export const toolchainDir: string = join(repoRoot, "tests/toolchains/vue");

/** Every file under a directory, recursively, as absolute paths. */
function filesUnder(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .toSorted();
}

/** The committed Vue golden outputs of the integration corpus. */
export function goldenFiles(): string[] {
  return filesUnder(casesDir).filter((path) => /\/__output__\/vue\/[^/]+\.vue$/.test(path));
}

/** Each corpus case's IR snapshot, with the directory its golden outputs live in. */
export function corpus(): { name: string; module: UfModule; outputDir: string }[] {
  return filesUnder(casesDir)
    .filter((path) => path.endsWith("/__output__/ir.json"))
    .map((path) => ({
      name: path.slice(casesDir.length + 1, -"/__output__/ir.json".length),
      module: JSON.parse(readFileSync(path, "utf8")) as UfModule,
      outputDir: join(path, "../vue"),
    }));
}

/** What this target emits for a module, formatted as the compiler formats it. */
export async function emitFormatted(module: UfModule): Promise<OutputFile[]> {
  const context: EmitContext = {
    module,
    options: undefined,
    report: (diagnostic) => {
      throw new Error(`unexpected diagnostic: ${diagnostic.message}`);
    },
  };
  const files = module.components.flatMap((component) => target.emit(component, context));
  return Promise.all(
    files.map(async (file) => {
      const outcome = await formatOutput(file);
      if (outcome.error) throw new Error(`${file.path} does not format: ${outcome.error}`);
      return outcome.file;
    }),
  );
}

const scratch: string[] = [];

/**
 * A fresh directory inside this package (gitignored `.uf-tmp/`), so files written there resolve
 * `vue` like the package itself does. {@link removeScratch} deletes it.
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
