import { applyFixes } from "@unframework/diagnostics";
import type { Diagnostic } from "@unframework/diagnostics";
import { checkInvariants } from "@unframework/ir";
import type { ElementNode, UfComponent, UfModule } from "@unframework/ir";
import { parseModule } from "@unframework/parser";

import { analyze } from "../src/index.ts";
import type { AnalyzeResult } from "../src/index.ts";

/**
 * Analyses a source. Every test that runs the analyser also checks that the IR it lowers keeps
 * the IR's invariants, which the compiler would otherwise report as an internal error, and
 * survives a JSON round trip unchanged, as snapshots and plugins see it.
 */
export function run(source: string, file = "Test.uf.tsx"): AnalyzeResult {
  const result = analyze(parseModule(file, source));
  if (result.module) {
    const broken = checkInvariants(result.module);
    if (broken.length) {
      throw new Error(`The IR of ${JSON.stringify(source)} breaks: ${JSON.stringify(broken)}`);
    }
    const undefinedAt = undefinedKey(result.module, "");
    if (undefinedAt !== undefined) {
      throw new Error(`The IR of ${JSON.stringify(source)} sets ${undefinedAt} to undefined.`);
    }
  }
  for (const diagnostic of result.diagnostics) {
    if (typeof diagnostic.message !== "string") {
      throw new TypeError(`A ${diagnostic.code} of ${JSON.stringify(source)} has no message.`);
    }
    for (const at of [diagnostic.span, ...(diagnostic.related ?? []).map((item) => item.span)]) {
      if (at.start < 0 || at.start > at.end || at.end > source.length) {
        throw new RangeError(
          `A ${diagnostic.code} of ${JSON.stringify(source)} points outside it.`,
        );
      }
    }
  }
  return result;
}

/**
 * The JSON Pointer of a key whose value is `undefined`, which a JSON round trip would drop: the
 * builders leave an absent optional field out (ADR-0032).
 */
function undefinedKey(value: unknown, path: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) return `${path}/${key}`;
    const found = undefinedKey(item, `${path}/${key}`);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** What a test component declares besides its returned JSX. */
export interface ComponentOptions {
  /**
   * The members of its props type (`label: string; tone?: "a" | "b"`), declared as `Props` and
   * destructured whole, or with `pattern` when given.
   */
  props?: string;
  /** The destructuring pattern, or the parameter as written (`props`), for `props`. */
  pattern?: string;
  /** Declarations before the component: types, other components. */
  before?: string;
  /** Setup statements before the return. */
  setup?: string;
}

/** Analyses a component `A` that returns `jsx`, with the props and setup the options give. */
export function component(
  jsx: string,
  options: ComponentOptions = {},
): { source: string } & AnalyzeResult {
  const { props, before = "", setup = "" } = options;
  const parameter =
    props === undefined
      ? ""
      : `${options.pattern ?? `{ ${memberNames(props).join(", ")} }`}: Props`;
  const types = props === undefined ? "" : `interface Props { ${props} }\n`;
  const source = `${before}${types}export function A(${parameter}) { ${setup}return ${jsx}; }`;
  return { source, ...run(source) };
}

/** The names of an object type's members, at its top level. */
function memberNames(members: string): string[] {
  const names: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index <= members.length; index++) {
    const character = members[index];
    if (character === "{" || character === "(" || character === "[" || character === "<") depth++;
    else if (character === "}" || character === ")" || character === "]" || character === ">")
      depth--;
    else if ((character === ";" || character === undefined) && depth === 0) {
      const name = /^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*:/.exec(
        members.slice(start, index),
      )?.[1];
      if (name) names.push(name);
      start = index + 1;
    }
  }
  return names;
}

/** The one component of a module. */
export function only(module: UfModule | undefined): UfComponent {
  if (module?.components.length !== 1) throw new Error("Expected exactly one component.");
  return module.components[0]!;
}

/** The root element of a module's one component. */
export function root(module: UfModule | undefined): ElementNode {
  const { render } = only(module);
  if (render.kind !== "Element") throw new Error(`Expected an element root, got ${render.kind}.`);
  return render;
}

export function codes(diagnostics: readonly Diagnostic[]): string[] {
  return diagnostics.map((diagnostic) => diagnostic.code);
}

export function slices(source: string, diagnostics: readonly Diagnostic[]): string[] {
  return diagnostics.map((diagnostic) => source.slice(diagnostic.span.start, diagnostic.span.end));
}

/** Each diagnostic as `code text-under-its-span`. */
export function problems(source: string, diagnostics: readonly Diagnostic[]): string[] {
  return diagnostics.map(
    (diagnostic) =>
      `${diagnostic.code} ${source.slice(diagnostic.span.start, diagnostic.span.end)}`,
  );
}

/**
 * Applies every fix and analyses the result, as the harness's L1 does: the diagnostics that
 * had no fix must be exactly what remains. Returns the fixed source.
 */
export function applyAndRecheck(source: string, diagnostics: readonly Diagnostic[]): string {
  const fixable = diagnostics.filter((diagnostic) => diagnostic.fixes?.length);
  const fixed = applyFixes(
    source,
    fixable.flatMap((diagnostic) => diagnostic.fixes ?? []),
  );
  const key = (diagnostic: Diagnostic) => `${diagnostic.code} ${diagnostic.message}`;
  const remaining = diagnostics.filter((diagnostic) => !fixable.includes(diagnostic)).map(key);
  const after = run(fixed).diagnostics.map(key);
  if (after.join("\n") !== remaining.join("\n")) {
    throw new Error(
      `The fixes do not recompile clean.\nFixed source: ${fixed}\nExpected:\n${remaining.join("\n")}\nGot:\n${after.join("\n")}`,
    );
  }
  return fixed;
}
