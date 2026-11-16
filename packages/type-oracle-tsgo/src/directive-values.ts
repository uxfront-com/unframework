// A directive's value checked against its type argument (ADR-0109). TypeScript doesn't type a
// dashed JSX attribute, so `v-focus-trap={1}` type-checks against `defineDirective<boolean>`:
// the checker types the value where it is written, narrowed by its branch, and tests it against
// the `T` of the `Directive<T, E>` the directive's name holds, with its own assignability.

import type { DirectiveValueCheck, DirectiveValueChecks, Span } from "@unframework.dev/type-oracle";
import type { Node, SourceFile } from "typescript/ast";
import { isIdentifier, isJsxAttribute, isStringLiteral } from "typescript/ast/is";
import { SymbolFlags, TypeFlags } from "typescript/sync";
import type { Checker, Symbol, Type, TypeReference } from "typescript/sync";

export interface DirectiveValueContext {
  checker: Checker;
  /** The queried file, as the checker's program holds it. */
  source: SourceFile;
  /** The query's own file, relative to the root, which `dependencies` leaves out. */
  file: string;
  /** The file of a source file as a shape names it, or `undefined` outside the root (a lib). */
  fileOf(fileName: string): string | undefined;
  /**
   * Whether a declaration's file is part of the authoring package, `@uxfront/unframework`, as the
   * queried file resolves it.
   */
  isAuthoring(fileName: string): boolean;
}

/** A query's nodes: the value and the directive's name, with the value's text. */
interface Located {
  value: Node;
  directive: Node;
  text: string;
}

/**
 * Checks each query's value against its directive's `T`. A query is `null` where the checker
 * cannot say: the file's text differs at the value, the name isn't a `Directive` of the
 * authoring package, or a type is the error type or `T` is `never`.
 */
export function checkDirectiveValues(
  queries: readonly { value: Span; text: string; directive: Span }[],
  context: DirectiveValueContext,
): DirectiveValueChecks {
  const { checker, source } = context;
  const located: (Located | undefined)[] = queries.map((query) => {
    // The oracle reads the disk, and the source compiled may differ, as a canary's does.
    if (source.text.slice(query.value.start, query.value.end) !== query.text) return undefined;
    const value = nodeAt(source, query.value);
    // An import specifier spans exactly its name: the name is the identifier inside it.
    const directive = nodeAt(source, query.directive, isIdentifier);
    return value && directive ? { value, directive, text: query.text } : undefined;
  });
  const found = located.filter((each): each is Located => each !== undefined);
  // One request each for every use's symbol and every value's type.
  const symbols = found.length
    ? checker.getSymbolAtLocation(found.map((each) => each.directive))
    : [];
  const types = found.length ? checker.getTypeAtLocation(found.map((each) => each.value)) : [];
  const dependencies = new Set<string>();
  /** Each directive's `T`, by its symbol's id. */
  const directives = new Map<number, Type | undefined>();
  let at = 0;
  const checks = located.map((each): DirectiveValueCheck | null => {
    if (!each) return null;
    const index = at++;
    const named = symbols[index];
    if (!named) return null;
    const symbol = named.flags & SymbolFlags.Alias ? checker.getAliasedSymbol(named) : named;
    if (checker.isUnknownSymbol(symbol)) return null;
    for (const declaration of symbol.declarations) {
      const file = declaration.resolve()?.getSourceFile().fileName;
      const name = file === undefined ? undefined : context.fileOf(file);
      if (name !== undefined && name !== context.file) dependencies.add(name);
    }
    if (!directives.has(symbol.id)) directives.set(symbol.id, directiveType(symbol, context));
    const expected = directives.get(symbol.id);
    if (!expected) return null;
    return isJsxAttribute(each.value.parent) && isStringLiteral(each.value)
      ? checkText(each.text.slice(1, -1), expected, checker)
      : checkType(types[index]!, expected, checker);
  });
  return { checks, dependencies: [...dependencies].toSorted() };
}

/**
 * The `T` of the `Directive<T, E>` a symbol holds, or `undefined` for a symbol that holds no
 * `Directive` of the authoring package, or whose `T` is the error type or `never`, which a
 * `defineDirective` without its type argument gives.
 */
function directiveType(symbol: Symbol, context: DirectiveValueContext): Type | undefined {
  const { checker } = context;
  const type = checker.getTypeOfSymbol(symbol);
  if (type.isErrorType() || !type.isTypeReference()) return undefined;
  const target = type.getSymbol();
  if (!target || target.name !== "Directive" || !(target.flags & SymbolFlags.Interface)) {
    return undefined;
  }
  // A `Directive` declared anywhere else is another type that happens to share the name.
  const declared = target.declarations.map((each) => each.resolve()?.getSourceFile().fileName);
  if (!declared.length || !declared.every((file) => file && context.isAuthoring(file))) {
    return undefined;
  }
  const [expected] = checker.getTypeArguments(type as TypeReference);
  if (!expected || expected.isErrorType() || expected.flags & TypeFlags.Never) return undefined;
  return expected;
}

/** An expression's value: its type, as the checker gives it where it is written. */
function checkType(value: Type, expected: Type, checker: Checker): DirectiveValueCheck | null {
  if (value.isErrorType()) return null;
  return {
    assignable: checker.isTypeAssignableTo(value, expected),
    value: checker.typeToString(value),
    expected: checker.typeToString(expected),
  };
}

/**
 * A string attribute's value (`v-tone="warn"`), tested by its text: the checker gives a JSX
 * attribute's string literal the error type, and has no literal type to build from a text. The
 * analyser rejects a static value holding `\`, `&` or a line break, so the text is the value.
 */
function checkText(text: string, expected: Type, checker: Checker): DirectiveValueCheck | null {
  const printed = checker.typeToString(expected);
  const answer = (assignable: boolean) => ({
    assignable,
    value: JSON.stringify(text),
    expected: printed,
  });
  if (checker.isTypeAssignableTo(checker.getStringType(), expected)) return answer(true);
  const members = expected.isUnionType() ? (expected.getTypes() ?? []) : [expected];
  if (members.some((member) => member.isStringLiteralType() && member.value === text)) {
    return answer(true);
  }
  // A text may match a template literal, an `Uppercase<…>` or a branded string without the
  // adapter being able to tell: those are left to the outputs' own checks.
  if (
    members.some(
      (member) =>
        member.isTemplateLiteralType() ||
        member.isStringMappingType() ||
        member.isIntersectionType(),
    )
  ) {
    return null;
  }
  return answer(false);
}

/** The outermost node at exactly `span`, of those `accept` takes. */
function nodeAt(
  source: SourceFile,
  span: Span,
  accept: (node: Node) => boolean = () => true,
): Node | undefined {
  let found: Node | undefined;
  const visit = (node: Node): void => {
    if (found || node.pos > span.start || node.end < span.end) return;
    if (node.getStart(source) === span.start && node.end === span.end && accept(node)) {
      found = node;
      return;
    }
    node.forEachChild(visit);
  };
  source.forEachChild(visit);
  return found;
}
