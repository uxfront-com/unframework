// Test helpers: a `.uf.tsx` source lowered as the compiler lowers it (the analyser, then the IR's
// invariants), and this target's output for it, unformatted (what `emit` prints) or formatted
// (what the compiler writes).
import { formatOutput } from "@unframework/codegen";
import type { EmitContext, OutputFile } from "@unframework/codegen";
import { checkInvariants } from "@unframework/ir";
import type { UfModule } from "@unframework/ir";

// The analyser is three layers down: tests lower real sources through it rather than hand-build
// IR it would never produce (the package's turbo.json hashes it into this package's tests).
import { analyze, shapeQueries } from "../../analyzer/src/index.ts";
import type { Shapes } from "../../analyzer/src/index.ts";
import { parseModule } from "../../parser/src/index.ts";
// Reached through the analyser's transit node, which hashes the type oracle it depends on.
import { createSyntacticOracle } from "../../type-oracle/src/index.ts";
import target from "../src/index.ts";

/** The IR of a source that must lower without an error or a warning. */
export function lower(source: string, file = "Card.uf.tsx", shapes?: Shapes): UfModule {
  const { module, diagnostics } = analyze(parseModule(file, source), shapes ? { shapes } : {});
  if (diagnostics.length || !module) {
    throw new Error(`${file} does not lower cleanly: ${JSON.stringify(diagnostics)}`);
  }
  const broken = checkInvariants(module);
  if (broken.length) throw new Error(`${file} lowers invalid IR: ${JSON.stringify(broken)}`);
  return module;
}

/** The files this target emits for each component of a source, which must report nothing. */
export function emitSource(source: string, file?: string, shapes?: Shapes): OutputFile[] {
  const module = lower(source, file, shapes);
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

/**
 * The one file a single-component source emits, as `emit` prints it, with the types it imports
 * from the modules beside it (`files`, by their paths) resolved as `compile()` resolves them,
 * through a syntactic type oracle over those files (ADR-0067).
 */
export async function emittedWithTypes(
  source: string,
  files: Readonly<Record<string, string>>,
): Promise<string> {
  const file = "Card.uf.tsx";
  const project: Record<string, string> = { ...files, [file]: source };
  const oracle = createSyntacticOracle({
    root: "/project",
    readFile: async (path) => project[path.slice("/project/".length)],
  });
  const resolved = new Map<string, Awaited<ReturnType<typeof oracle.resolveShape>>>();
  for (const query of shapeQueries(parseModule(file, source))) {
    resolved.set(`${query.span.start}:${query.span.end}`, await oracle.resolveShape(query));
  }
  const [output, ...more] = emitSource(source, file, (span) =>
    resolved.get(`${span.start}:${span.end}`),
  );
  if (!output || more.length) throw new Error("Expected one file.");
  return output.contents;
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

/**
 * The `scopeAttributes` helper, as the frontmatter of a component whose root takes its styled
 * parents' scope declares it.
 */
export const SCOPE_HELPER: readonly string[] = [
  "/** The scope attributes of the styled parents that render this component, for its root. */",
  'function scopeAttributes(props: object): Record<string, ""> {',
  '  const scope: Record<string, ""> = {};',
  '  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";',
  "  return scope;",
  "}",
];
