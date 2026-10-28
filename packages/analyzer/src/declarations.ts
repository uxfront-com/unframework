// The module's type declarations (ADR-0034, ADR-0045): the `interface` and `type` declarations
// that the components' props, events and setup code use, which the outputs copy as written. Each
// is checked where it is declared, once, as a top-level statement: one some component's props
// reach must be a type every target's props can declare (ADR-0034); one only the setup
// reaches is copied, so it must only copy safely (ADR-0045); and one no component reaches is
// exported on its own (ADR-0068), or reported. Every props type is read from its shape, through
// the type oracle (ADR-0067); the members of the declarations it reaches are checked as written
// (`checkMembers`, `checkType`) by the props, which leave to the shape what only it resolves
// (`props.ts`).

import type { DiagnosticCode } from "@unframework/diagnostics";
import { isIdentifier, RESERVED_TYPE_NAMES } from "@unframework/ir";
import type { AST, TypeDeclarationStatement } from "@unframework/parser";
import { visitorKeys } from "@unframework/parser";

import type { Reporter } from "./context.ts";
import { checkDirectives } from "./expressions.ts";
import type { ComponentFunction } from "./render.ts";
import { memberName, TypeTable } from "./types/from-type.ts";

/** The module's type declarations, and which the components' props and setup code reach. */
export interface ModuleTypes {
  readonly table: TypeTable;
  readonly declarations: readonly TypeDeclarationStatement[];
  /** The names some component's props type reaches, through local references. */
  readonly reached: ReadonlySet<string>;
  /**
   * The names some component's setup code reaches and no props type does: the type arguments
   * of `ref` and `defineEmits`, annotations, `as` (ADR-0045). The outputs copy them.
   */
  readonly setupReached: ReadonlySet<string>;
  /** Whether some component writes `Props` as its props annotation itself (`(props: Props)`). */
  readonly ownProps: boolean;
  /**
   * The props annotations that reach `Props` without being it (`(props: BadgeProps)`, with
   * `interface BadgeProps { inner: Props }`): Astro's output declares a `Props` of its own for
   * each of their components, beside the copied one.
   */
  readonly foreignProps: readonly AST.TSType[];
  /**
   * The diagnostics already reported at a span of a type declaration: components that share a
   * declaration report its props' problems once.
   */
  readonly reported: Set<string>;
  /**
   * The type parameters of the generic component being checked (ADR-0068), which its props and
   * its events' payloads may name.
   */
  readonly parameters?: ReadonlySet<string>;
}

/**
 * Reads the module's type declarations, and what the candidates' props annotations and setup
 * code, and the module's injection keys and top-level `const`s, reach.
 */
export function collectTypes(
  declarations: readonly TypeDeclarationStatement[],
  candidates: readonly { node: ComponentFunction }[],
  keys: readonly unknown[] = [],
): ModuleTypes {
  const table = new TypeTable(declarations);
  const reached = new Set<string>();
  // An injection key's type, and what a module's constant writes of types, are copied as the
  // setup's types are, into the output that declares them (ADR-0054, ADR-0070).
  const setupReached = new Set<string>(closure(keys, table));
  let ownProps = false;
  const foreignProps: AST.TSType[] = [];
  for (const candidate of candidates) {
    for (const name of setupTypes(candidate.node, table)) setupReached.add(name);
    const parameter = candidate.node.params[0];
    const annotation =
      parameter && "typeAnnotation" in parameter ? parameter.typeAnnotation : undefined;
    if (!annotation) continue;
    const type = annotation.typeAnnotation;
    const names = closure(type, table);
    const own =
      type.type === "TSTypeReference" &&
      type.typeName.type === "Identifier" &&
      type.typeName.name === "Props";
    if (own) ownProps = true;
    else if (names.includes("Props")) foreignProps.push(type);
    for (const name of names) reached.add(name);
  }
  for (const name of reached) setupReached.delete(name);
  return {
    table,
    declarations,
    reached,
    setupReached,
    ownProps,
    foreignProps,
    reported: new Set(),
  };
}

/**
 * The names of the module's type declarations a component's code reaches besides its props'
 * annotation (ADR-0045): every type its type parameters' constraints and defaults (ADR-0068) and
 * its body write, in source order. The outputs copy them as written.
 */
export function setupTypes(fn: ComponentFunction, table: TypeTable): string[] {
  return closure([fn.typeParameters, fn.params.slice(1), fn.body], table);
}

/**
 * The names of the module's type declarations a type, or the types in a node, reach through
 * every reference in it, the interfaces it extends, and the declarations it reaches, in source
 * order.
 */
export function closure(type: unknown, table: TypeTable): string[] {
  const found = new Set<string>();
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const typed = node as {
      type?: string;
      typeName?: { type: string; name?: string };
      expression?: { type: string; name?: string };
    };
    const reference =
      typed.type === "TSTypeReference"
        ? typed.typeName
        : typed.type === "TSInterfaceHeritage"
          ? typed.expression
          : undefined;
    if (reference?.type === "Identifier") {
      const name = reference.name!;
      const declaration = table.declaration(name);
      if (declaration && !found.has(name)) {
        found.add(name);
        visit(declaration.node);
      }
    }
    for (const key of visitorKeys[typed.type ?? ""] ?? []) {
      visit((node as Record<string, unknown>)[key]);
    }
  };
  visit(type);
  return [...found].toSorted(
    (a, b) => table.declaration(a)!.span.start - table.declaration(b)!.span.start,
  );
}

/**
 * Checks a top-level type declaration: declared once, holding no text that would end a script
 * block or Astro's frontmatter, named apart from the types the outputs declare, and reached by
 * some component's props or setup, or exported. It may be generic (ADR-0068). The members of a
 * type the props reach are checked by the props (`props.ts`).
 */
export function checkTypeDeclaration(
  declaration: TypeDeclarationStatement,
  types: ModuleTypes,
  source: string,
  comments: readonly AST.Comment[],
  reporter: Reporter,
): void {
  const { node, name } = declaration;
  const id = node.id;
  const first = types.table.declaration(name);
  if (first !== declaration) {
    reporter.unsupported(
      id,
      `\`${name}\` is declared twice: TypeScript merges the declarations, which the outputs would not.`,
      { help: "Declare it once." },
    );
    return;
  }
  if (!isIdentifier(name)) {
    reporter.unsupported(
      id,
      `\`${name}\` is not written in ASCII letters, digits, \`_\` and \`$\`: the outputs name types as Angular's templates read names.`,
      { help: "Rename the type." },
    );
  }
  // `Props` may be a component's own props type, which the outputs keep as it is, when every
  // component whose props reach it takes it as its props type: Astro's output declares a
  // `Props` of its own for any other, beside the copied one (ADR-0034).
  const own = name === "Props" && types.ownProps && !types.foreignProps.length;
  const clash = own ? undefined : RESERVED_TYPE_NAMES.get(name);
  if (clash) {
    const related =
      name === "Props"
        ? types.foreignProps.map((type) => ({
            span: { start: type.start, end: type.end },
            message: "These props reach it, and Astro's output declares their own `Props`",
          }))
        : [];
    reporter.report("UF2003", id, `A local type cannot be named \`${name}\`: ${clash}.`, {
      help: "Rename the type.",
      ...(related.length ? { related } : {}),
    });
  }
  const setup = types.setupReached.has(name);
  if (!types.reached.has(name) && !setup) {
    if (declaration.exported) {
      // Exported on its own, for consumers' types (ADR-0068): every output exports it as
      // written.
      checkCopiedText({ start: node.start, end: node.end }, source, reporter, "A type declaration");
      checkDirectives({ start: node.start, end: node.end }, comments, reporter);
      return;
    }
    reporter.unsupported(
      id,
      `\`${name}\` is neither exported nor used by any component, so no output would declare it.`,
      { help: "Export it, use it in a component's props or code, or remove it." },
    );
    return;
  }
  if (node.declare) {
    reporter.unsupported(node, "Ambient type declarations (`declare`) are not supported.");
  }
  if (setup) {
    // Only the setup's code reaches it: the outputs copy it as written, so it only needs to copy
    // safely (ADR-0045); the types its events' payloads reach are the rules' to check (UF2009).
    checkCopiedText({ start: node.start, end: node.end }, source, reporter, "A type declaration");
    checkDirectives({ start: node.start, end: node.end }, comments, reporter);
    return;
  }
  checkCopiedText({ start: node.start, end: node.end }, source, reporter, "A type declaration");
  checkDirectives({ start: node.start, end: node.end }, comments, reporter);
  // Its members are checked by the props that reach it, as written where the syntax can read
  // them and on their shapes where only the type oracle resolves them (ADR-0067).
}

/**
 * Reports text that would end the block an output copies it into: `</script` ends a Vue or
 * Svelte script block (as HTML reads end tags, in any case), and a line that is only `---` ends
 * an Astro component's frontmatter (UF1002).
 */
export function checkCopiedText(at: Span, source: string, reporter: Reporter, what: string): void {
  const text = source.slice(at.start, at.end);
  const script = /<\/script/i.exec(text);
  if (script) {
    const start = at.start + script.index;
    reporter.unsupported(
      { start, end: start + script[0].length },
      `${what} cannot hold \`</script\`: it would end the Vue or Svelte script block it is copied into.`,
      { help: "Write it as `<\\/script`, or split the string." },
    );
  }
  const fence = /^---[ \t]*$/m.exec(text);
  if (fence) {
    const start = at.start + fence.index;
    reporter.unsupported(
      { start, end: start + 3 },
      `${what} cannot hold a line that is only \`---\`: it would end the Astro frontmatter it is copied into.`,
    );
  }
}

interface Span {
  start: number;
  end: number;
}

/**
 * Checks the members of an interface or an object type literal (ADR-0034). With `shaped`, the
 * names a props type imports, it checks a type the props read from their shape (ADR-0067).
 */
export function checkMembers(
  members: readonly AST.TSSignature[],
  types: ModuleTypes,
  reporter: Reporter,
  shaped?: ReadonlySet<string>,
): void {
  const names = new Set<string>();
  for (const member of members) {
    switch (member.type) {
      case "TSPropertySignature": {
        const name = member.computed ? undefined : memberName(member.key);
        if (name === undefined) {
          report(types, reporter, "UF6002", member.key, ...needsChecker("A computed key"));
          continue;
        }
        // TypeScript rejects it (TS2300), and the outputs would declare the prop twice.
        if (names.has(name)) {
          report(types, reporter, "UF2001", member.key, ...declaredTwice(name));
          continue;
        }
        names.add(name);
        const type = member.typeAnnotation?.typeAnnotation;
        if (!type) {
          report(types, reporter, "UF1002", member, "A member of a props type needs a type.");
          continue;
        }
        checkType(type, types, reporter, shaped);
        break;
      }
      case "TSMethodSignature":
      case "TSCallSignatureDeclaration":
      case "TSConstructSignatureDeclaration":
        report(types, reporter, "UF1002", member, FUNCTIONS);
        break;
      case "TSIndexSignature":
        report(types, reporter, "UF6002", member, ...needsChecker("An index signature"));
        break;
    }
  }
}

/** What UF6002 calls an intersection the default type oracle reads only part of (ADR-0067). */
export const INTERSECTION: string =
  "An intersection with a part the default type oracle cannot read as an object type";

export const FUNCTIONS: string =
  "Function types are not supported in props: a callback is an event, which a component declares with `defineEmits` (ADR-0047), and a render function is a slot (`defineSlots`).";

/**
 * The message and help for a type the default type oracle cannot evaluate (UF6002, ADR-0067).
 */
export function needsChecker(what: string): [message: string, help: string] {
  return [
    `${what} needs a type checker to evaluate, and the default type oracle reads types as written.`,
    "Write the type out with interfaces, aliases, unions and object types, or compile with the tsgo type oracle, `@unframework/type-oracle-tsgo`.",
  ];
}

/** The message and help for a type no target's props can declare (UF6002, ADR-0034). */
export function notAProp(what: string): [message: string, help: string] {
  return [`${what} is not a type a prop can take.`, PROP_TYPES];
}

const PROP_TYPES =
  "Give the prop a string, number or boolean type, a literal type, `null` or `undefined`, an array or an object type, or a union of these (ADR-0034).";

/**
 * Checks a member's type: the types every target's props can declare (ADR-0034). With `shaped`,
 * the names a props type imports, the type is one the props read from their shape (ADR-0067): an
 * imported type and a utility or generic type are left to the props' check of the shape, where
 * they are resolved; an intersection's object parts are checked here, and an intersection with
 * any other part, or of empty object types alone, is reported.
 */
export function checkType(
  type: AST.TSType,
  types: ModuleTypes,
  reporter: Reporter,
  shaped?: ReadonlySet<string>,
): void {
  const later = (what: string) => report(types, reporter, "UF6002", type, ...notAProp(what));
  const unevaluated = (what: string) =>
    report(types, reporter, "UF6002", type, ...needsChecker(what));
  switch (type.type) {
    case "TSStringKeyword":
    case "TSNumberKeyword":
    case "TSBooleanKeyword":
    case "TSNullKeyword":
    case "TSUndefinedKeyword":
      return;
    case "TSLiteralType": {
      const { literal } = type;
      if (literal.type === "TemplateLiteral") {
        if (literal.expressions.length) unevaluated("A template literal type");
        return;
      }
      if (literal.type === "Literal" && typeof literal.value === "bigint") later("A BigInt type");
      return;
    }
    case "TSUnionType":
      for (const member of type.types) checkType(member, types, reporter, shaped);
      return;
    case "TSArrayType":
      checkType(type.elementType, types, reporter, shaped);
      return;
    case "TSParenthesizedType":
      checkType(type.typeAnnotation, types, reporter, shaped);
      return;
    case "TSTypeOperator":
      if (type.operator === "readonly" && type.typeAnnotation.type === "TSArrayType") {
        checkType(type.typeAnnotation, types, reporter, shaped);
      } else {
        unevaluated(`\`${type.operator}\``);
      }
      return;
    case "TSTypeLiteral":
      if (!type.members.length) later("The empty object type `{}`");
      checkMembers(type.members, types, reporter, shaped);
      return;
    case "TSTypeReference": {
      const name = type.typeName.type === "Identifier" ? type.typeName.name : undefined;
      const argument = type.typeArguments?.params;
      if ((name === "Array" || name === "ReadonlyArray") && argument?.length === 1) {
        checkType(argument[0]!, types, reporter, shaped);
        return;
      }
      if (name !== undefined && !type.typeArguments && types.table.declaration(name)) return;
      if (name !== undefined && !type.typeArguments && types.parameters?.has(name)) return;
      if (shaped && (type.typeArguments || (name !== undefined && shaped.has(name)))) return;
      // Any other type is one the module neither declares nor reads (a global), or one only a
      // checker evaluates.
      if (name !== undefined && !type.typeArguments) {
        report(types, reporter, "UF6001", type, ...undeclared(name));
      } else {
        report(types, reporter, "UF6002", type, ...needsChecker("This type"));
      }
      return;
    }
    case "TSFunctionType":
    case "TSConstructorType":
      report(types, reporter, "UF1002", type, FUNCTIONS);
      return;
    case "TSAnyKeyword":
      return later("`any`");
    case "TSUnknownKeyword":
      return later("`unknown`");
    case "TSObjectKeyword":
      return later("`object`");
    case "TSSymbolKeyword":
      return later("`symbol`");
    case "TSBigIntKeyword":
      return later("`bigint`");
    case "TSVoidKeyword":
      return later("`void`");
    case "TSNeverKeyword":
      return later("`never`");
    case "TSTupleType":
      return later("A tuple type");
    case "TSTemplateLiteralType":
      return unevaluated("A template literal type");
    case "TSIntersectionType": {
      if (!shaped) return later("An intersection type");
      let other = false;
      for (const part of type.types) {
        if (part.type === "TSTypeLiteral") checkMembers(part.members, types, reporter, shaped);
        else if (part.type === "TSParenthesizedType" || part.type === "TSIntersectionType") {
          checkType(part, types, reporter, shaped);
        } else if (part.type !== "TSTypeReference") other = true;
      }
      const empty = type.types.every(
        (part) => part.type === "TSTypeLiteral" && !part.members.length,
      );
      if (other) report(types, reporter, "UF6002", type, ...notAProp(INTERSECTION));
      else if (empty) later("An intersection of empty object types");
      return;
    }
    default:
      return unevaluated("This type");
  }
}

/** The message and help for a member a type writes twice (UF2001, TS2300). */
export function declaredTwice(name: string): [message: string, help: string] {
  return [
    `\`${name}\` is declared twice in this type: TypeScript rejects the second, and every target would declare it twice.`,
    "Declare it once.",
  ];
}

/** The message and help for a type name the module neither declares nor imports (UF6001). */
export function undeclared(name: string): [message: string, help: string] {
  return [
    `\`${name}\` is neither declared nor imported by this module: the compiler reads no global type in a props type.`,
    "Declare the type in this module, or import it from the module that declares it.",
  ];
}

/**
 * Reports a problem at a span of a type, once: components that share a declaration would
 * report its props' problems twice.
 */
export function report(
  types: ModuleTypes,
  reporter: Reporter,
  code: DiagnosticCode,
  at: { start: number; end: number },
  message: string,
  help?: string,
): void {
  const key = `${code} ${at.start} ${at.end} ${message}`;
  if (types.reported.has(key)) return;
  types.reported.add(key);
  if (code === "UF1002") reporter.unsupported(at, message, help ? { help } : {});
  else reporter.report(code, at, message, help ? { help } : {});
}
