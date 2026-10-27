// The types the analyser reads through the type oracle (ADR-0067). The analyser is synchronous
// and the oracle is not, so `compile()` asks the oracle for the shape of each type a module
// writes where an API is declared, before it analyses, as it asks its resolver for each child's
// API (ADR-0053), and hands the shapes to `analyze`.

import type { Span } from "@unframework/ir";
import { visitorKeys } from "@unframework/parser";
import type { AST, ParsedModule } from "@unframework/parser";
import { localShapes } from "@unframework/type-oracle";
import type { ShapeQuery, TypeShape } from "@unframework/type-oracle";

import { isAuthoringModule } from "./frameworks.ts";

/**
 * The shape of the type a module writes at a span, as `shapeQueries` names it: `undefined` for a
 * span the module writes no type at, or one no query named.
 */
export type Shapes = (span: Span) => TypeShape | undefined;

/** The macros whose type arguments declare an API: events, models and slots. */
const API_MACROS = new Set(["defineEmits", "defineModel", "defineSlots"]);

/**
 * The types a module writes whose shapes the analyser reads (ADR-0067), in source order, each
 * once: each props annotation, each type argument of `defineEmits`, `defineModel` and
 * `defineSlots`, each `InjectionKey<…>`'s argument, and each other annotation or type argument
 * in a function's body that names a type the module imports. What `compile()` asks the type
 * oracle for before the module is analysed.
 */
export function shapeQueries(parsed: ParsedModule): ShapeQuery[] {
  const imported = typeImportNames(parsed.program);
  const found = new Map<string, ShapeQuery>();
  const add = (type: AST.TSType) => {
    const key = `${type.start}:${type.end}`;
    if (!found.has(key)) {
      found.set(key, { file: parsed.file, span: { start: type.start, end: type.end } });
    }
  };
  const names = (type: AST.TSType): boolean => {
    let named = false;
    visit(type, (node) => {
      if (
        node.type === "TSTypeReference" &&
        node.typeName.type === "Identifier" &&
        imported.has(node.typeName.name)
      ) {
        named = true;
      }
      return !named;
    });
    return named;
  };
  const inBody = (node: AST.Node) => {
    visit(node, (each) => {
      // A member's annotation inside a type is the type's, queried with it.
      if (each.type === "TSTypeLiteral") return false;
      if (each.type === "TSTypeAnnotation" && names(each.typeAnnotation)) add(each.typeAnnotation);
      if (each.type === "CallExpression" && each.typeArguments) {
        const callee = each.callee.type === "Identifier" ? each.callee.name : undefined;
        for (const argument of each.typeArguments.params) {
          if ((callee && API_MACROS.has(callee)) || names(argument)) add(argument);
        }
      }
      if (
        each.type === "TSTypeReference" &&
        each.typeName.type === "Identifier" &&
        each.typeName.name === "InjectionKey"
      ) {
        for (const argument of each.typeArguments?.params ?? []) add(argument);
      }
      return true;
    });
  };
  for (const fn of functions(parsed.program)) {
    const [parameter] = fn.params;
    const annotation =
      parameter && "typeAnnotation" in parameter ? parameter.typeAnnotation : undefined;
    if (annotation) add(annotation.typeAnnotation);
    if (fn.body) inBody(fn.body);
  }
  // A key declared at the module's top level (ADR-0054).
  for (const statement of parsed.program.body) {
    if (statement.type !== "FunctionDeclaration") inBody(statement);
  }
  return [...found.values()].toSorted((a, b) => a.span.start - b.span.start);
}

/**
 * The shapes the analyser reads when it is given none (ADR-0067): the module's own
 * declarations, through the type oracle's in-module path, which reads no file. A type imported
 * from another module is `unresolved` as `external`.
 */
export function ownShapes(parsed: ParsedModule): Shapes {
  return localShapes(parsed, parsed.file);
}

/** The local names of the types a module imports from modules other than the authoring API. */
export function typeImportNames(program: AST.Program): Set<string> {
  const names = new Set<string>();
  for (const statement of program.body) {
    if (statement.type !== "ImportDeclaration" || isAuthoringModule(statement.source.value)) {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (
        statement.importKind === "type" ||
        (specifier.type === "ImportSpecifier" && specifier.importKind === "type")
      ) {
        names.add(specifier.local.name);
      }
    }
  }
  return names;
}

/** The functions a module declares at its top level, exported or not, written as values too. */
function functions(program: AST.Program): AST.Function[] {
  const found: (AST.Function | AST.ArrowFunctionExpression)[] = [];
  for (const statement of program.body) {
    const declaration =
      (statement.type === "ExportNamedDeclaration" ||
        statement.type === "ExportDefaultDeclaration") &&
      statement.declaration
        ? statement.declaration
        : statement;
    if (declaration.type === "FunctionDeclaration") found.push(declaration);
    if (declaration.type === "VariableDeclaration") {
      for (const declarator of declaration.declarations) {
        const init = declarator.init;
        if (init?.type === "ArrowFunctionExpression" || init?.type === "FunctionExpression") {
          found.push(init);
        }
      }
    }
  }
  return found as AST.Function[];
}

/** Walks a node's tree, entering each node's children when `enter` returns true. */
function visit(node: unknown, enter: (node: AST.Node) => boolean): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) visit(item, enter);
    return;
  }
  const typed = node as AST.Node;
  if (typeof typed.type !== "string") return;
  if (!enter(typed)) return;
  for (const key of visitorKeys[typed.type] ?? []) {
    visit((node as Record<string, unknown>)[key], enter);
  }
}
