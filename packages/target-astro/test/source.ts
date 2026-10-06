// Test helpers: a `.uf.tsx` source lowered as the compiler lowers it (the analyser, then the IR's
// invariants), and this target's output for it, unformatted (what `emit` prints) or formatted
// (what the compiler writes).
import { formatOutput } from "@unframework/codegen";
import type { EmitContext, OutputFile } from "@unframework/codegen";
import { checkInvariants } from "@unframework/ir";
import type { UfModule } from "@unframework/ir";

// The analyser is three layers down: tests lower real sources through it rather than hand-build
// IR it would never produce (the package's turbo.json hashes it into this package's tests).
import { analyze } from "../../analyzer/src/index.ts";
import { parseModule } from "../../parser/src/index.ts";
import target from "../src/index.ts";

/** The IR of a source that must lower without an error or a warning. */
export function lower(source: string, file = "Card.uf.tsx"): UfModule {
  const { module, diagnostics } = analyze(parseModule(file, source));
  if (diagnostics.length || !module) {
    throw new Error(`${file} does not lower cleanly: ${JSON.stringify(diagnostics)}`);
  }
  const broken = checkInvariants(module);
  if (broken.length) throw new Error(`${file} lowers invalid IR: ${JSON.stringify(broken)}`);
  return module;
}

/** The files this target emits for each component of a source, which must report nothing. */
export function emitSource(source: string, file?: string): OutputFile[] {
  const module = lower(source, file);
  const reported: unknown[] = [];
  const context: EmitContext = {
    module,
    options: undefined,
    report: (diagnostic) => void reported.push(diagnostic),
  };
  const files = module.components.flatMap((component) => target.emit(component, context));
  if (reported.length) throw new Error(`emit reported ${JSON.stringify(reported)}`);
  return files;
}

/** The one file a single-component source emits, as `emit` prints it. */
export function emitted(source: string): string {
  const [file, ...more] = emitSource(source);
  if (!file || more.length) throw new Error("Expected one file.");
  return file.contents;
}

/** The one file a single-component source emits, formatted as the compiler writes it. */
export async function compiled(source: string): Promise<string> {
  const [file] = emitSource(source);
  const { file: formatted, error } = await formatOutput(file!);
  if (error) throw new Error(error);
  return formatted.contents;
}
