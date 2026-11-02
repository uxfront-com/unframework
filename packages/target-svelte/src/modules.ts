// What a component or a composable reads of its module (ADR-0070): the values it imports from
// relative `.ts` modules, which its output imports from its copy of the module as the source
// does, and the module's top-level constants, which its output declares at the top of its
// script, before the props. The instance script is one scope with the setup, so a module name a
// top-level binding of the setup shadows is declared under a name of its own, and every module
// text that reads it (a constant's value, a `typeof` in a type the output copies) reads it there.
import {
  codeKind,
  codeNames,
  parseCodeSource,
  parseExpressionSource,
  typeNames,
} from "@unframework/codegen";
import type { CodeKind, NameScope } from "@unframework/codegen";
import { codeOf } from "@unframework/ir";
import type { Code, TypeDeclaration, TypeText, UfComponent, UfModule } from "@unframework/ir";

import { visit } from "./ast.ts";
import type { AstNode } from "./ast.ts";

/** What a component or a composable reaches of its module (ADR-0070). */
export interface ModuleReach {
  /** The constants and value imports its output declares and imports, by local name. */
  values: Set<string>;
  /** The module's type declarations its constants name, transitively, beyond its own. */
  types: TypeDeclaration[];
  /** The type names its constants and those declarations read, which its output imports. */
  typeNames: Set<string>;
}

/**
 * The module's names an owner reaches (ADR-0070): the imported values and the constants it
 * reads, those its constants read in turn, and those a `typeof` names, in the owner's own text
 * where no top-level binding of it shadows the name, and in the module's text it copies (a
 * constant's annotation, a type declaration) always. `typeTexts` adds what the owner's IR does
 * not hold: a composable's parameter types.
 */
export function moduleReach(
  owner: UfComponent,
  module: UfModule,
  typeTexts: readonly TypeText[] = [],
): ModuleReach {
  const moduleValues = new Set([
    ...(module.constants ?? []).map(({ name }) => name),
    ...(module.moduleImports ?? []).flatMap(({ names }) => names.map(({ local }) => local)),
  ]);
  const values = new Set(
    owner.bindings
      .filter((binding) => binding.kind === "import" || binding.kind === "moduleConst")
      .map((binding) => binding.name),
  );
  const query = (text: string, kind: CodeKind | "type", shadowed: ReadonlySet<string>) => {
    for (const { name } of typeQueries(text, kind)) {
      if (moduleValues.has(name) && !shadowed.has(name)) values.add(name);
    }
  };
  const shadowed = topLevelNames(owner);
  for (const { code } of codeOf(owner)) query(code.code, codeKind(code, owner), shadowed);
  for (const text of ownTypes(owner)) query(text.code, "type", shadowed);
  for (const text of typeTexts) query(text.code, "type", new Set());
  const own = new Set(owner.types);
  const named = new Set<string>();
  const declared = new Set<string>();
  for (let size = -1; size !== values.size + declared.size;) {
    size = values.size + declared.size;
    for (const constant of module.constants ?? []) {
      if (!values.has(constant.name)) continue;
      for (const reference of constant.value.refs) {
        if (reference.kind === "Binding") values.add(nameOf(reference.binding));
      }
      if (constant.type) {
        for (const name of typeNames(constant.type)) named.add(name);
        query(constant.type.code, "type", new Set());
      }
      for (const name of codeNames(constant.value.code)) named.add(name);
      query(constant.value.code, "expression", new Set());
    }
    for (const declaration of module.types) {
      if (!own.has(declaration.name) && !named.has(declaration.name)) continue;
      if (!own.has(declaration.name)) declared.add(declaration.name);
      for (const name of codeNames(declaration.code, "statements")) named.add(name);
      query(declaration.code, "statements", new Set());
    }
  }
  return {
    values,
    types: module.types.filter((declaration) => declared.has(declaration.name)),
    typeNames: named,
  };
}

/**
 * The names the output declares the reached module names by: each its own, but one a top-level
 * binding of the owner shadows, which takes a name of its own. Every reached name is reserved
 * first, so no name the script claims later captures one.
 */
export function moduleLocals(
  owner: UfComponent,
  reach: ModuleReach,
  scope: NameScope,
): Map<string, string> {
  scope.reserve(...reach.values);
  const shadowed = topLevelNames(owner);
  const locals = new Map<string, string>();
  for (const name of reach.values) locals.set(name, shadowed.has(name) ? scope.claim(name) : name);
  return locals;
}

/**
 * The constants an owner reaches, in source order, each as written but for the module names it
 * reads, spelled as the output declares them.
 */
export function constantsCode(
  module: UfModule,
  reach: ModuleReach,
  locals: ReadonlyMap<string, string>,
): string[] {
  return (module.constants ?? [])
    .filter((constant) => reach.values.has(constant.name))
    .map((constant) => {
      const type = constant.type ? `: ${renamedQueries(constant.type.code, "type", locals)}` : "";
      return `const ${locals.get(constant.name) ?? constant.name}${type} = ${renamedValue(constant.value, locals)};`;
    });
}

/** A type declaration's text with each module name a `typeof` queries spelled as declared. */
export function renamedDeclaration(code: string, locals: ReadonlyMap<string, string>): string {
  return renamedQueries(code, "statements", locals);
}

/** Type text with each module name a `typeof` queries spelled as declared. */
export function renamedType(text: string, locals: ReadonlyMap<string, string>): string {
  return renamedQueries(text, "type", locals);
}

/** The owner's top-level bindings: those its setup and props declare, over the whole script. */
function topLevelNames(owner: UfComponent): Set<string> {
  return new Set([
    ...owner.bindings
      .filter(
        ({ kind }) =>
          kind !== "moduleConst" && kind !== "import" && kind !== "loopVar" && kind !== "slotScope",
      )
      .map(({ name }) => name),
    ...(owner.propsParameter?.name ? [owner.propsParameter.name] : []),
  ]);
}

/** The type text an owner's IR writes beside its code: its props', setup's and emits' types. */
function ownTypes(owner: UfComponent): TypeText[] {
  const found: TypeText[] = [];
  if (owner.propsParameter) found.push(owner.propsParameter.type);
  for (const prop of owner.props) found.push(prop.type);
  for (const item of owner.setup) if ("type" in item && item.type) found.push(item.type);
  if (owner.emits) found.push(owner.emits.type);
  for (const parameter of owner.typeParameters ?? []) {
    if (parameter.constraint) found.push(parameter.constraint);
    if (parameter.default) found.push(parameter.default);
  }
  return found;
}

/**
 * A constant's value with each module name it reads written as the output declares it, a
 * shorthand property expanded (`{ LIMITS: LIMITS_1 }`).
 */
function renamedValue(value: Code, locals: ReadonlyMap<string, string>): string {
  const edits: { start: number; end: number; text: string }[] = [];
  let shorthand: ReadonlySet<number> | undefined;
  for (const reference of value.refs) {
    if (reference.kind !== "Binding") continue;
    const name = nameOf(reference.binding);
    const local = locals.get(name) ?? name;
    if (local === name) continue;
    const start = reference.span.start - value.span.start;
    shorthand ??= shorthandValues(value.code);
    const key = reference.shorthand || shorthand.has(start) ? `${name}: ` : "";
    edits.push({ start, end: reference.span.end - value.span.start, text: `${key}${local}` });
  }
  for (const { name, start, end } of typeQueries(value.code, "expression")) {
    const local = locals.get(name) ?? name;
    if (local !== name) edits.push({ start, end, text: local });
  }
  return applied(value.code, edits);
}

/** Type text or code with each module name a `typeof` queries written as declared. */
function renamedQueries(
  text: string,
  kind: CodeKind | "type",
  locals: ReadonlyMap<string, string>,
): string {
  const edits = typeQueries(text, kind).flatMap(({ name, start, end }) => {
    const local = locals.get(name) ?? name;
    return local === name ? [] : [{ start, end, text: local }];
  });
  return applied(text, edits);
}

function applied(text: string, edits: readonly { start: number; end: number; text: string }[]) {
  let written = "";
  let last = 0;
  for (const edit of edits.toSorted((a, b) => a.start - b.start)) {
    written += `${text.slice(last, edit.start)}${edit.text}`;
    last = edit.end;
  }
  return `${written}${text.slice(last)}`;
}

/**
 * The root identifier of each `typeof` in type text or code, with its offsets: `SIZES` in
 * `keyof typeof SIZES`, `theme` in `typeof theme.dark`.
 */
function typeQueries(
  text: string,
  kind: CodeKind | "type",
): { name: string; start: number; end: number }[] {
  // Type text parses as the type of an assertion, whose offsets the prefix shifts.
  const prefix = kind === "type" ? "null as " : "";
  let root: unknown;
  try {
    root =
      kind === "type"
        ? parseExpressionSource(`${prefix}${text}`).expression
        : parseCodeSource(text, kind).root;
  } catch {
    return [];
  }
  const found: { name: string; start: number; end: number }[] = [];
  visit(root, (node) => {
    if (node.type !== "TSTypeQuery") return;
    let name = node["exprName"] as AstNode | undefined;
    while (name?.type === "TSQualifiedName") name = name["left"] as AstNode;
    if (name?.type === "Identifier" && typeof name["name"] === "string") {
      found.push({
        name: name["name"],
        start: name.start - prefix.length,
        end: name.end - prefix.length,
      });
    }
  });
  return found;
}

/**
 * Where an expression's shorthand properties' values start (`{ LIMITS }`): a constant's
 * references carry no `shorthand` mark, so the code says.
 */
function shorthandValues(code: string): Set<number> {
  const found = new Set<number>();
  visit(parseExpressionSource(code).expression, (node) => {
    const value = node["value"] as AstNode | undefined;
    if (node.type === "Property" && node["shorthand"] === true && value) found.add(value.start);
  });
  return found;
}

/** The name of a binding id, `name@offset`. */
function nameOf(id: string): string {
  return id.slice(0, id.lastIndexOf("@"));
}
