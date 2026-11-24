// A directive's value checked against its type argument (ADR-0109). TypeScript doesn't type a
// dashed JSX attribute, so `v-focus-trap={1}` type-checks against `defineDirective<boolean>`. The
// adapter types a shadow of the compiled source instead, in which each value is wrapped where it
// stands, `v-tone={__ufDirectiveValue(vTone, (value))}`: the helper gives the value the
// directive's `T` as its context, as an assignment would, so a template literal or a generic
// call is typed as TypeScript types it there, and the value keeps its branch's narrowing.

import type {
  DirectiveValueCheck,
  DirectiveValueChecks,
  DirectiveValueQuery,
} from "@unframework.dev/type-oracle";
import type { CallExpression, Node, SourceFile } from "typescript/ast";
import { isCallExpression, isIdentifier } from "typescript/ast/is";
import { SymbolFlags, TypeFlags } from "typescript/sync";
import type { Checker, Type, TypeReference } from "typescript/sync";

/** The shadow of a source: its text, and where each query's helper call starts in it. */
export interface Shadow {
  text: string;
  /** The offset of each query's call in `text`, in the queries' order. */
  calls: number[];
}

/** The helper's name, when the source's text doesn't already hold it. */
const HELPER = "__ufDirectiveValue";

/**
 * The shadow of `source`: each query's value wrapped in a call of the helper, which takes the
 * directive and the value, and the helper's declaration at the end. A string attribute's value,
 * `v-tone="warn"`, becomes a container, `v-tone={__ufDirectiveValue(vTone, ("warn"))}`: the
 * analyser rejects a static value holding `\`, `&` or a line break, so its literal reads alike in
 * JavaScript. A leading byte order mark is dropped, since the parser's spans count it and the
 * checker's positions don't.
 */
export function shadowOf(source: string, queries: readonly DirectiveValueQuery[]): Shadow {
  const bom = source.startsWith("\uFEFF") ? 1 : 0;
  let helper = HELPER;
  for (let suffix = 1; source.includes(helper); suffix++) {
    helper = `${HELPER}${suffix}`;
  }
  const order = queries
    .map((query, index) => ({ query, index }))
    .toSorted((a, b) => a.query.value.start - b.query.value.start);
  const calls: number[] = Array.from({ length: queries.length }, () => -1);
  let text = "";
  let at = bom;
  for (const { query, index } of order) {
    const { value, directive } = query;
    // Spans that overlap are no two values the parser gave: the later one is left out.
    if (value.start < at) {
      continue;
    }
    text += source.slice(at, value.start);
    // The parser says which a value is: a string attribute's literal takes the braces of a
    // container, which a container's expression already has.
    const attribute = query.kind === "string";
    const call = `${helper}(${source.slice(directive.start, directive.end)}, (${source.slice(value.start, value.end)}))`;
    if (attribute) {
      text += "{";
    }
    calls[index] = text.length;
    text += call;
    if (attribute) {
      text += "}";
    }
    at = value.end;
  }
  text += source.slice(at);
  text += `\ndeclare function ${helper}<T>(directive: import("@uxfront/unframework").Directive<T, any>, value: NoInfer<T>): void;\n`;
  return { text, calls };
}

export interface DirectiveValueContext {
  checker: Checker;
  /** The shadow, as the checker's program holds it. */
  source: SourceFile;
  /** The queried file and its shadow, relative to the root, which `dependencies` leave out. */
  file: string;
  shadow: string;
  /** The file of a source file as a shape names it, or `undefined` outside the root (a lib). */
  fileOf(fileName: string): string | undefined;
  /**
   * Whether a declaration's file is part of the authoring package, `@uxfront/unframework`, as the
   * queried file resolves it.
   */
  isAuthoring(fileName: string): boolean;
}

/**
 * Checks each value of a typed shadow against its directive's `T`. A query is `null` where the
 * checker cannot say: its call isn't in the shadow, the directive isn't a `Directive` of the
 * authoring package, or a type is the error type or `T` is `never`.
 */
export function checkShadow(shadow: Shadow, context: DirectiveValueContext): DirectiveValueChecks {
  const { checker, source } = context;
  const located = shadow.calls.map((start) => (start === -1 ? undefined : callAt(source, start)));
  const found = located.filter((call): call is CallExpression => call !== undefined);
  // One request each for every directive's symbol, every directive's type and every value's type.
  const directives = found.map((call) => call.arguments[0]!);
  const symbols = found.length ? checker.getSymbolAtLocation(directives) : [];
  const directiveTypes = found.length ? checker.getTypeAtLocation(directives) : [];
  const valueTypes = found.length
    ? checker.getTypeAtLocation(found.map((call) => call.arguments[1]!))
    : [];
  const dependencies = new Set<string>();
  let index = 0;
  const checks = located.map((call): DirectiveValueCheck | null => {
    if (!call) {
      return null;
    }
    const at = index++;
    const named = symbols[at];
    const symbol =
      named && named.flags & SymbolFlags.Alias ? checker.getAliasedSymbol(named) : named;
    for (const declaration of symbol?.declarations ?? []) {
      const file = declaration.resolve()?.getSourceFile().fileName;
      const name = file === undefined ? undefined : context.fileOf(file);
      if (name !== undefined && name !== context.file && name !== context.shadow) {
        dependencies.add(name);
      }
    }
    const expected = directiveType(directiveTypes[at]!, context);
    const value = valueTypes[at]!;
    if (!expected || value.isErrorType()) {
      return null;
    }
    return {
      assignable: checker.isTypeAssignableTo(value, expected),
      value: checker.typeToString(value),
      expected: checker.typeToString(expected),
    };
  });
  return { checks, dependencies: [...dependencies].toSorted() };
}

/**
 * The `T` of a `Directive<T, E>` of the authoring package, or `undefined` for any other type, or
 * for a `T` that is the error type or `never`, which a `defineDirective` without its type
 * argument gives.
 */
function directiveType(type: Type, context: DirectiveValueContext): Type | undefined {
  if (type.isErrorType() || !type.isTypeReference()) {
    return undefined;
  }
  const target = type.getSymbol();
  if (!target || target.name !== "Directive" || !(target.flags & SymbolFlags.Interface)) {
    return undefined;
  }
  // A `Directive` declared anywhere else is another type that happens to share the name.
  const declared = target.declarations.map((each) => each.resolve()?.getSourceFile().fileName);
  if (!declared.length || !declared.every((file) => file && context.isAuthoring(file))) {
    return undefined;
  }
  const [expected] = context.checker.getTypeArguments(type as TypeReference);
  if (!expected || expected.isErrorType() || expected.flags & TypeFlags.Never) {
    return undefined;
  }
  return expected;
}

/** The helper's call that starts at `start`, with its two arguments. */
function callAt(source: SourceFile, start: number): CallExpression | undefined {
  let found: CallExpression | undefined;
  const visit = (node: Node): void => {
    if (found || node.pos > start || node.end <= start) {
      return;
    }
    if (
      isCallExpression(node) &&
      node.getStart(source) === start &&
      isIdentifier(node.expression) &&
      node.arguments.length === 2
    ) {
      found = node;
      return;
    }
    node.forEachChild(visit);
  };
  source.forEachChild(visit);
  return found;
}
