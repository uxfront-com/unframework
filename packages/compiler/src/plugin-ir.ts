// What a compiler plugin's `ir` hook may return besides valid IR (ADR-0032): a module that still
// describes the source it was analysed from, and copies into the outputs no code the analyser
// did not analyse.
import { expressionsOf, spansOf } from "@unframework/ir";
import type {
  Expression,
  IrValidationError,
  TypeDeclaration,
  TypeText,
  UfModule,
} from "@unframework/ir";

/**
 * Where a plugin's module (schema-valid) stops describing the source it was analysed from:
 * - another file, or a span outside the source: diagnostics point at those spans, and JSON and
 *   SARIF output refuse a location outside its file;
 * - an expression, a type annotation or a type declaration that is not one the analyser produced
 *   for this module (`analysed`), compared whole: span, code and references. Every target copies
 *   them into its output, rewriting only the references, and the IR cannot parse code: a span
 *   moved into a string literal or a comment, or a reference dropped, would hand the targets
 *   code nobody analysed (P2). A plugin may move, copy or drop analysed code, never write its
 *   own.
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
  for (const [index, component] of result.components.entries()) {
    const base = `/components/${index}`;
    if (component.propsParameter) {
      const { type } = component.propsParameter;
      if (!known.has(typeTextKey(type))) {
        problems.push({ path: `${base}/propsParameter/type`, message: NOT_ANALYSED.type });
      }
    }
    for (const [prop, { type }] of component.props.entries()) {
      if (!known.has(typeTextKey(type))) {
        problems.push({ path: `${base}/props/${prop}/type`, message: NOT_ANALYSED.type });
      }
    }
    for (const { expression, path } of expressionsOf(component, base)) {
      if (!known.has(expressionKey(expression))) {
        problems.push({ path, message: NOT_ANALYSED.expression });
      }
    }
  }
  for (const [index, declaration] of result.types.entries()) {
    if (!known.has(declarationKey(declaration))) {
      problems.push({ path: `/types/${index}`, message: NOT_ANALYSED.declaration });
    }
  }
  return problems;
}

const NOT_ANALYSED = {
  expression:
    "must be an expression the analyser produced, with its span, code and references: a plugin may move, copy or drop analysed code, never write its own",
  type: "must be a type annotation the analyser produced, with its span and code",
  declaration: "must be a type declaration the analyser produced, as it produced it",
} as const;

/** Every expression, type annotation and type declaration of a module, by its key. */
function analysedCode(module: UfModule): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const declaration of module.types) keys.add(declarationKey(declaration));
  for (const component of module.components) {
    if (component.propsParameter) keys.add(typeTextKey(component.propsParameter.type));
    for (const { type } of component.props) keys.add(typeTextKey(type));
    for (const { expression } of expressionsOf(component)) keys.add(expressionKey(expression));
  }
  return keys;
}

// Keys read every field the schema allows, so two values with one key are deep-equal, whatever
// order their keys were written in (an absent `shorthand` is false, as JSON reads it).

function expressionKey({ code, span, refs }: Expression): string {
  const references = refs.map((ref) =>
    ref.kind === "Binding"
      ? [ref.kind, ref.binding, ref.span.start, ref.span.end, ref.shorthand === true]
      : [ref.kind, ref.name, ref.span.start, ref.span.end],
  );
  return JSON.stringify(["Expression", code, span.start, span.end, references]);
}

function typeTextKey({ code, span }: TypeText): string {
  return JSON.stringify(["TypeText", code, span.start, span.end]);
}

function declarationKey({ name, exported, code, span }: TypeDeclaration): string {
  return JSON.stringify(["TypeDeclaration", name, exported, code, span.start, span.end]);
}

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
