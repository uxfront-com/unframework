// Sources lowered by the real parser and analyser, for the emitter's shape tests: the IR M1
// emits from is easier to read, and to trust, as the source an author writes. Imported by path,
// as the render-parity kit does: a target package depends on ir and codegen only.
import { formatOutput } from "@unframework/codegen";
import type { EmitContext } from "@unframework/codegen";
import type { UfModule } from "@unframework/ir";
import { expect } from "vitest";

import { analyze } from "../../analyzer/src/index.ts";
import { parseModule } from "../../parser/src/index.ts";
import target from "../src/index.ts";

/** The module the analyser lowers a source to, which must hold no error. */
export function lower(source: string, file = "Card.uf.tsx"): UfModule {
  const { module, diagnostics } = analyze(parseModule(file, source));
  expect(diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  return module!;
}

/**
 * A source's first component as the Qwik target emits it, formatted as the compiler formats
 * it. The target reports nothing (ADR-0033: what it cannot render, its capabilities declare).
 * Fallthrough gives every component `class` and `style` props (ADR-0054): the shape tests leave
 * it out, as `defineOptions({ inheritAttrs: false })` does, unless `fallthrough` asks for it.
 */
export async function emitSource(
  source: string,
  options: { fallthrough?: boolean } = {},
): Promise<string> {
  const module = lower(source);
  if (!options.fallthrough) module.components[0]!.inheritAttrs = false;
  const reported: unknown[] = [];
  const context: EmitContext = {
    module,
    options: undefined,
    report: (diagnostic) => void reported.push(diagnostic),
  };
  const [file, ...rest] = target.emit(module.components[0]!, context);
  expect(reported).toEqual([]);
  expect(rest).toEqual([]);
  const outcome = await formatOutput(file!);
  expect(outcome.error).toBeUndefined();
  return outcome.file.contents;
}
