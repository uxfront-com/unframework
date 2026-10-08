// What a compiler plugin's `ir` hook may return besides valid IR (ADR-0032): a module that still
// describes the source it was analysed from, and copies into the outputs no code the analyser
// did not analyse.
import { codeOf, expressionsOf, functionsOf, spansOf } from "@unframework/ir";
import type {
  Code,
  CodeReference,
  EventControl,
  Emits,
  Expression,
  FunctionCode,
  IrValidationError,
  LocatedFunction,
  Parameter,
  Span,
  TypeDeclaration,
  TypeText,
  UfComponent,
  UfModule,
} from "@unframework/ir";

/**
 * Where a plugin's module (schema-valid) stops describing the source it was analysed from:
 * - another file, or a span outside the source: diagnostics point at those spans, and JSON and
 *   SARIF output refuse a location outside its file;
 * - an expression, a piece of setup code, a function, a type annotation, a type declaration or
 *   the declared events that are not ones the analyser produced for this module (`analysed`),
 *   compared whole: spans, code, references and every flag. Every target copies them into its
 *   output, rewriting only the references, and the IR cannot parse code: a span moved into a
 *   string literal or a comment, a reference dropped, a write turned into a read, or a
 *   parameter's default or type changed, would hand the targets code nobody analysed (P2). A
 *   plugin may move, copy or drop analysed code, never write its own;
 * - a function or a piece of code moved to a slot of another context or role: the analyser
 *   judges client code by looser rules than a getter or an initial value (time, chance and
 *   in-place changes), so a function is keyed by its context and role, and code by its context
 *   and whether it is statements or an expression (ADR-0045).
 */
export function pluginIrProblems(
  result: UfModule,
  analysed: UfModule,
  source: string,
): IrValidationError[] {
  const problems: IrValidationError[] = [];
  if (result.file !== analysed.file) {
    problems.push({ path: "/file", message: `must stay "${analysed.file}", the file analysed` });
  }
  for (const { span, path } of spansOf(result)) {
    if (!isSpanIn(span, source.length)) {
      problems.push({ path, message: `must lie in the source (${source.length} characters)` });
    }
  }
  const known = analysedCode(analysed);
  const check = (key: string, path: string, message: string) => {
    if (!known.has(key)) problems.push({ path, message });
  };
  for (const [index, component] of result.components.entries()) {
    const base = `/components/${index}`;
    if (component.propsParameter) {
      check(
        typeTextKey(component.propsParameter.type),
        `${base}/propsParameter/type`,
        NOT_ANALYSED.type,
      );
    }
    for (const [prop, { type }] of component.props.entries()) {
      check(typeTextKey(type), `${base}/props/${prop}/type`, NOT_ANALYSED.type);
    }
    for (const { expression, path } of expressionsOf(component, base)) {
      check(expressionKey(expression), path, NOT_ANALYSED.expression);
    }
    for (const [position, item] of component.setup.entries()) {
      if ("type" in item && item.type) {
        check(typeTextKey(item.type), `${base}/setup/${position}/type`, NOT_ANALYSED.type);
      }
    }
    // A function is compared whole, its body and its event controls' conditions included, so
    // the code inside one is not compared again on its own.
    const functions = functionsOf(component, base);
    for (const located of functions) {
      check(functionKey(located), located.path, NOT_ANALYSED.function);
    }
    for (const { key, path } of codeKeys(component, functions, base)) {
      if (functions.some((located) => path.startsWith(`${located.path}/`))) continue;
      check(key, path, NOT_ANALYSED.code);
    }
    if (component.emits) check(emitsKey(component.emits), `${base}/emits`, NOT_ANALYSED.emits);
  }
  for (const [index, declaration] of result.types.entries()) {
    check(declarationKey(declaration), `/types/${index}`, NOT_ANALYSED.declaration);
  }
  return problems;
}

const NOT_ANALYSED = {
  expression:
    "must be an expression the analyser produced, with its span, code and references: a plugin may move, copy or drop analysed code, never write its own",
  code: "must be code the analyser produced, with its span, code and references, where code of its context runs: a plugin may move, copy or drop analysed code, never write its own",
  function:
    "must be a function the analyser produced, with its parameters, types, body, event controls and flags, in a place of its context and role",
  type: "must be a type annotation the analyser produced, with its span and code",
  emits: "must be the events the analyser produced, as it produced them",
  declaration: "must be a type declaration the analyser produced, as it produced it",
} as const;

/**
 * Every expression, piece of code, function, type annotation, type declaration and events
 * declaration of a module, by its key.
 */
function analysedCode(module: UfModule): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const declaration of module.types) keys.add(declarationKey(declaration));
  for (const component of module.components) {
    if (component.propsParameter) keys.add(typeTextKey(component.propsParameter.type));
    for (const { type } of component.props) keys.add(typeTextKey(type));
    for (const { expression } of expressionsOf(component)) keys.add(expressionKey(expression));
    for (const item of component.setup) {
      if ("type" in item && item.type) keys.add(typeTextKey(item.type));
    }
    const functions = functionsOf(component);
    for (const located of functions) keys.add(functionKey(located));
    for (const { key } of codeKeys(component, functions)) keys.add(key);
    if (component.emits) keys.add(emitsKey(component.emits));
  }
  return keys;
}

// Keys read every field the schema allows, so two values with one key are deep-equal, whatever
// order their keys were written in (an absent flag is false, as JSON reads it).

function expressionKey(expression: Expression): string {
  return JSON.stringify(expressionValue(expression));
}

/**
 * Each piece of code of a component with its key: the context it runs in, whether it is a block
 * of statements (a function's block body) or an expression, and its value.
 */
function codeKeys(
  component: UfComponent,
  functions: readonly LocatedFunction[],
  base = "",
): { key: string; path: string }[] {
  const bodies = new Map(functions.map(({ function: fn, path }) => [`${path}/body`, fn]));
  return codeOf(component, base).map(({ code, path, context }) => {
    const fn = bodies.get(path);
    const kind = fn && fn.expression !== true ? "statements" : "expression";
    return { key: JSON.stringify([context, kind, codeValue(code)]), path };
  });
}

/** A function's key: the context it runs in, its role, and its value. */
function functionKey({ function: fn, context, role }: LocatedFunction): string {
  return JSON.stringify([context, role, functionValue(fn)]);
}

function typeTextKey(type: TypeText): string {
  return JSON.stringify(typeTextValue(type));
}

function emitsKey({ binding, type, events, span }: Emits): string {
  return JSON.stringify([
    "Emits",
    binding,
    typeTextValue(type),
    events.map((event) => [
      event.name,
      event.parameters.map((parameter) => [
        parameter.name,
        parameter.optional === true,
        typeTextValue(parameter.type),
        spanValue(parameter.span),
      ]),
      spanValue(event.span),
    ]),
    spanValue(span),
  ]);
}

function declarationKey({ name, exported, code, span }: TypeDeclaration): string {
  return JSON.stringify(["TypeDeclaration", name, exported, code, span.start, span.end]);
}

function expressionValue({ code, span, refs }: Expression): unknown[] {
  return ["Expression", code, span.start, span.end, refs.map(referenceValue)];
}

function codeValue({ code, span, refs }: Code): unknown[] {
  return ["Code", code, span.start, span.end, refs.map(referenceValue)];
}

/** A reference with every field its kind has, each kind read exhaustively. */
function referenceValue(reference: CodeReference): unknown[] {
  switch (reference.kind) {
    case "Binding":
      return [
        reference.kind,
        reference.binding,
        spanValue(reference.span),
        reference.shorthand === true,
        reference.call === true,
      ];
    case "Global":
      return [reference.kind, reference.name, spanValue(reference.span)];
    case "Write":
      return [
        reference.kind,
        reference.binding,
        reference.operator,
        spanValue(reference.span),
        spanValue(reference.target),
        reference.value ? spanValue(reference.value) : null,
        reference.arrowBody === true,
      ];
    case "Emit":
      return [
        reference.kind,
        reference.binding,
        reference.event,
        spanValue(reference.span),
        reference.arguments.map(spanValue),
      ];
    case "Api":
      return [reference.kind, reference.api, spanValue(reference.span)];
    case "Event":
      return [reference.kind, reference.member, spanValue(reference.span), reference.call === true];
    default:
      return unreachable(reference);
  }
}

function functionValue(fn: FunctionCode): unknown[] {
  return [
    "Function",
    fn.async === true,
    fn.parameters.map(parameterValue),
    fn.returnType ? typeTextValue(fn.returnType) : null,
    codeValue(fn.body),
    fn.expression === true,
    (fn.eventControls ?? []).map(controlValue),
    spanValue(fn.span),
  ];
}

function parameterValue(parameter: Parameter): unknown[] {
  const { pattern } = parameter;
  return [
    parameter.name ?? null,
    pattern ? [pattern.code, pattern.names, spanValue(pattern.span)] : null,
    parameter.type ? typeTextValue(parameter.type) : null,
    parameter.optional === true,
    parameter.rest === true,
    parameter.default ? expressionValue(parameter.default) : null,
    parameter.event ?? null,
    spanValue(parameter.span),
  ];
}

function controlValue(control: EventControl): unknown[] {
  return [
    control.method,
    control.condition ? codeValue(control.condition) : null,
    spanValue(control.span),
  ];
}

function typeTextValue({ code, span }: TypeText): unknown[] {
  return ["TypeText", code, span.start, span.end];
}

const spanValue = ({ start, end }: Span): number[] => [start, end];

/** Whether a span is a well-formed range of UTF-16 offsets in a source of `length` characters. */
export function isSpanIn(span: unknown, length: number): boolean {
  const isOffset = (offset: unknown): offset is number =>
    typeof offset === "number" && Number.isInteger(offset) && offset >= 0 && offset <= length;
  return (
    typeof span === "object" &&
    span !== null &&
    "start" in span &&
    "end" in span &&
    isOffset(span.start) &&
    isOffset(span.end) &&
    span.start <= span.end
  );
}

/** The `never` default of an exhaustive switch: a kind added to a union fails type checking. */
function unreachable(value: never): never {
  throw new Error(`Unexpected IR value: ${JSON.stringify(value)}`);
}
