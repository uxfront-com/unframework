// The TypeScript an Angular component file declares besides its class: the source's own type
// declarations (ADR-0034), and the type of each signal input (ADR-0034). Type text is copied as
// the author wrote it; it is parsed only to find the names it refers to and the `undefined` an
// input with a default leaves out of its value type.
import { parseExpressionSource, parseStatementsSource } from "@unframework/codegen";
import type { TypeDeclaration } from "@unframework/ir";

interface TypeNode {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

function isTypeNode(value: unknown): value is TypeNode {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string" &&
    typeof (value as { start?: unknown }).start === "number"
  );
}

/** The parser has no entry for a type alone: it reads one as the type of an `as` expression. */
const PREFIX = "0 as ";

/** A type as written, parsed: offsets in its nodes are relative to `code`. */
function parseType(code: string): TypeNode {
  const { expression } = parseExpressionSource(`${PREFIX}${code}`);
  const type = (expression as unknown as { typeAnnotation?: unknown }).typeAnnotation;
  if (expression.type !== "TSAsExpression" || !isTypeNode(type)) {
    throw new Error(`Cannot read \`${code}\` as a type.`);
  }
  return type;
}

/**
 * The names of the types a parsed type or declaration refers to (`Item` in `Item[]`,
 * `Array<Finish>`, `interface Props extends Base`).
 */
function referencedNames(node: TypeNode): Set<string> {
  const names = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!isTypeNode(value)) return;
    if (value.type === "TSTypeReference") {
      let name = value.typeName as { type: string; name?: string; left?: unknown };
      while (name.type === "TSQualifiedName") name = name.left as typeof name;
      if (typeof name.name === "string") names.add(name.name);
    }
    // An interface's heritage names its base as an expression (`extends Base`, `extends ns.Base`).
    if (value.type === "TSInterfaceHeritage") {
      let base = value.expression as { type: string; name?: string; object?: unknown };
      while (base.type === "MemberExpression") base = base.object as typeof base;
      if (typeof base.name === "string") names.add(base.name);
    }
    for (const [key, child] of Object.entries(value)) {
      if (key !== "type" && typeof child === "object") visit(child);
    }
  };
  visit(node);
  return names;
}

/** A type declaration as written, parsed: offsets in its nodes are relative to its code. */
function parseDeclaration(code: string): TypeNode {
  const [statement] = parseStatementsSource(code).statements as unknown[];
  if (
    !isTypeNode(statement) ||
    (statement.type !== "TSInterfaceDeclaration" && statement.type !== "TSTypeAliasDeclaration")
  ) {
    throw new Error(`Cannot read \`${code}\` as a type declaration.`);
  }
  return statement;
}

/**
 * The type a declaration declares, as a type on its own: an interface's body (an object type) or
 * an alias's right-hand side, read from the parsed declaration, since a header's type
 * parameters may hold a `{` or an `=` of their own (`interface List<T extends { id: string }>`,
 * `type P<T = string>`, ADR-0068).
 */
function declaredType(declaration: TypeDeclaration): string {
  const node = parseDeclaration(declaration.code);
  const type = (
    node.type === "TSInterfaceDeclaration" ? node.body : node.typeAnnotation
  ) as TypeNode;
  return declaration.code.slice(type.start, type.end);
}

/**
 * The names a whole declaration refers to: its body's or right-hand side's, an interface's bases'
 * and its type parameters' constraints and defaults (`Item` in `<T extends Item>`), but its own
 * type parameters.
 */
function declarationReferences(declaration: TypeDeclaration): Set<string> {
  const node = parseDeclaration(declaration.code);
  const names = referencedNames(node);
  const parameters = (node.typeParameters as { params?: { name?: { name?: unknown } }[] } | null)
    ?.params;
  for (const parameter of parameters ?? []) {
    const name = parameter.name?.name;
    if (typeof name === "string") names.delete(name);
  }
  return names;
}

/**
 * The type declarations a component's file declares, in source order: every exported one of
 * its closure (`component.types`), which consumers type their props with (M5), and every other
 * one the output reads (`roots`: an input's or an output's type, the setup's annotations and
 * code) or a declared one refers to. An Angular component types each input by its member's
 * type, never by the props type itself, so a props interface the source does not export would be
 * declared and never used, which the L5 baseline rejects (`no-unused-vars`).
 */
export function declaredTypes(
  closure: readonly TypeDeclaration[],
  roots: Iterable<string>,
): TypeDeclaration[] {
  const byName = new Map(closure.map((declaration) => [declaration.name, declaration]));
  const kept = new Set<string>();
  const pending = [
    ...roots,
    ...closure.filter(({ exported }) => exported).map((declaration) => declaration.name),
  ];
  for (let name = pending.pop(); name !== undefined; name = pending.pop()) {
    const declaration = byName.get(name);
    if (!declaration || kept.has(name)) continue;
    kept.add(name);
    pending.push(...declarationReferences(declaration));
  }
  return closure.filter((declaration) => kept.has(declaration.name));
}

/**
 * A type without `undefined`: the value type of an input with a default, which the input's
 * transform never lets through (ADR-0034). A union's `undefined` members are left out as
 * written; a reference to a local alias that admits `undefined` becomes `Exclude<…, undefined>`.
 */
export function withoutUndefined(code: string, declarations: readonly TypeDeclaration[]): string {
  return without(code, declarations, false);
}

/**
 * A type without `undefined` and `null`, as `??` and `!` leave it: a union's nullish members are
 * left out as written; a reference to a local alias that admits either becomes `NonNullable<…>`.
 */
export function withoutNullish(code: string, declarations: readonly TypeDeclaration[]): string {
  return without(code, declarations, true);
}

function without(code: string, declarations: readonly TypeDeclaration[], nullish: boolean): string {
  const left = (type: TypeNode) =>
    type.type === "TSUndefinedKeyword" || (nullish && type.type === "TSNullKeyword");
  const aliases = new Map(
    declarations
      .filter((declaration) => declaration.code.startsWith("type"))
      .map((declaration) => [declaration.name, declaredType(declaration)]),
  );
  // Whether an alias a member refers to admits what is left out, through other aliases.
  const admits = (type: TypeNode, seen: ReadonlySet<string>): boolean => {
    if (left(type)) return true;
    switch (type.type) {
      case "TSUnionType":
        return (type.types as TypeNode[]).some((member) => admits(member, seen));
      case "TSTypeReference": {
        const name = (type.typeName as { name?: unknown }).name;
        if (typeof name !== "string" || seen.has(name)) return false;
        const alias = aliases.get(name);
        return alias !== undefined && admits(parseType(alias), new Set([...seen, name]));
      }
      default:
        return false;
    }
  };
  const type = parseType(code);
  const members = type.type === "TSUnionType" ? (type.types as TypeNode[]) : [type];
  const kept = members.filter((member) => !left(member));
  if (!kept.length) return "never";
  // A function or conditional type keeps parentheses in a union.
  const text = (member: TypeNode) => {
    const written = code.slice(member.start - PREFIX.length, member.end - PREFIX.length);
    return kept.length > 1 && /=>|\bextends\b|^\s*new\b/.test(written) && !written.startsWith("(")
      ? `(${written})`
      : written;
  };
  const written = kept.length === members.length ? code.trim() : kept.map(text).join(" | ");
  if (!kept.some((member) => admits(member, new Set()))) return written;
  return nullish ? `NonNullable<${written}>` : `Exclude<${written}, undefined>`;
}

/**
 * The element type of an array type as written (`Item[]`, `readonly Item[]`, `Array<Item>`,
 * `ReadonlyArray<Item>`), or `undefined` for any other type.
 */
export function arrayElement(code: string): string | undefined {
  let type = parseType(code);
  const text = (node: TypeNode) => code.slice(node.start - PREFIX.length, node.end - PREFIX.length);
  if (type.type === "TSTypeOperator" && type.operator === "readonly") {
    type = type.typeAnnotation as TypeNode;
  }
  if (type.type === "TSArrayType") return text(type.elementType as TypeNode);
  if (type.type === "TSTypeReference") {
    const name = (type.typeName as { name?: unknown }).name;
    const parameters = (type.typeArguments as { params?: TypeNode[] } | null)?.params ?? [];
    if ((name === "Array" || name === "ReadonlyArray") && parameters.length === 1) {
      return text(parameters[0]!);
    }
  }
  return undefined;
}
