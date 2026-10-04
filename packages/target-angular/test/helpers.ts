import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { formatOutput } from "@unframework/codegen";
import type { EmitContext, OutputFile, ToolchainContext } from "@unframework/codegen";
import { checkInvariants } from "@unframework/ir";
import type { UfModule } from "@unframework/ir";
import type { Plugin, ResolvedConfig } from "vite";

// The analyser is no dependency of a target (plan §5.2): tests reach it from its source, as the
// render-parity kit does, to lower source snippets as `compile()` would rather than hand-build
// IR it would never produce.
import { analyze } from "../../analyzer/src/index.ts";
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

/** Each corpus case's IR snapshot, with the directory its Angular golden outputs live in. */
export function corpus(): { name: string; module: UfModule; outputDir: string }[] {
  return filesUnder(casesDir)
    .filter((path) => path.endsWith("/__output__/ir.json"))
    .map((path) => ({
      name: path.slice(casesDir.length + 1, -"/__output__/ir.json".length),
      module: JSON.parse(readFileSync(path, "utf8")) as UfModule,
      outputDir: join(path, "../angular"),
    }));
}

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

/** The IR of a source, as `compile()` lowers it: it must lower without an error or a warning. */
export function lower(source: string, file = "Card.uf.tsx"): UfModule {
  const { module, diagnostics } = analyze(parseModule(file, source));
  if (diagnostics.length || !module) {
    throw new Error(`${file} does not lower cleanly: ${JSON.stringify(diagnostics, null, 2)}`);
  }
  const broken = checkInvariants(module);
  if (broken.length) throw new Error(`${file} lowers invalid IR: ${JSON.stringify(broken)}`);
  return module;
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
  },
  code: string,
  id: string,
) => Promise<{ code: string; map: string | null }>;

/** The ngtsc plugin under test, with what it warned about and logged. */
export interface NgtscHarness {
  plugin: Plugin;
  warnings: string[];
  logged: string[];
  transform: (id: string, code?: string) => Promise<{ code: string; map: string | null }>;
}

/**
 * The ngtsc plugin, set up as Vite sets it up beside an unframework plugin that serves
 * `sources` (generated Angular code by virtual id), in a dev server's `consumer` environment.
 * `transform` runs its transform hook.
 */
export async function ngtscPlugin(
  sources: Record<string, string> = {},
  consumer: "client" | "server" = "server",
): Promise<NgtscHarness> {
  const plugin = ngtscVirtual(await loadCompiler(context.toolchainDir));
  const unframework = { name: "unframework", api: { getCompiled: (id: string) => sources[id] } };
  (plugin.configResolved as (config: ResolvedConfig) => void)({
    plugins: [unframework as Plugin, plugin],
  } as unknown as ResolvedConfig);
  const warnings: string[] = [];
  const logged: string[] = [];
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
  };
  const { handler } = plugin.transform as { handler: TransformHandler };
  return {
    plugin,
    warnings,
    logged,
    transform: (id: string, code = sources[id]!) => handler.call(pluginContext, code, id),
  };
}
