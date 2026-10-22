// The sources and the lowering the scoped-styles tests share (ADR-0063): each source is lowered
// as `compile()` lowers it, with the sheets and the child APIs its resolver would read.
import { formatOutput } from "@unframework/codegen";
import type { ModuleApi, UfModule } from "@unframework/ir";
import { expect } from "vitest";

import { analyze } from "../../analyzer/src/index.ts";
import { parseModule } from "../../parser/src/index.ts";
import target from "../src/index.ts";

/** A source lowered with the sheets and the child APIs its resolver gives, by specifier. */
export function lowered(
  file: string,
  source: string,
  sheets: Record<string, string> = {},
  imports: Record<string, ModuleApi> = {},
): { module: UfModule; api: ModuleApi } {
  const { module, api, diagnostics } = analyze(parseModule(file, source), {
    stylesheets: new Map(
      Object.entries(sheets).map(([specifier, text]) => [
        specifier,
        { file: specifier.slice(2), source: text, slotted: text.includes(":slotted(") },
      ]),
    ),
    imports: new Map(Object.entries(imports)),
  });
  expect(diagnostics).toEqual([]);
  return { module: module!, api: api! };
}

/** The formatted Qwik output of a module's component, its first by default. */
export async function output(module: UfModule, index = 0): Promise<string> {
  const reported: unknown[] = [];
  const [file] = target.emit(module.components[index]!, {
    module,
    options: undefined,
    report: (diagnostic) => void reported.push(diagnostic),
  });
  expect(reported).toEqual([]);
  const outcome = await formatOutput(file!);
  expect(outcome.error).toBeUndefined();
  return outcome.file.contents;
}

export const BUTTON = `export default function Button({ text }: { text: string }) {
  return <button type="button" class="button">{text}</button>;
}`;
