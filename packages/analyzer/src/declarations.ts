// The module's type declarations (ADR-0034, ADR-0045): the `interface` and `type` declarations
// that the components' props, events and setup code use, which the outputs copy as written. Each
// is checked where it is declared, once, as a top-level statement: one some component's props
// reach must be a type every target's props can declare (ADR-0034); one only the setup
// reaches is copied, so it must only copy safely (ADR-0045); and one no component reaches lands in
// M5.

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
}

/**
 * Reads the module's type declarations, and what the candidates' props annotations and setup
 * code, and the module's injection keys, reach.
 */
export function collectTypes(
  declarations: readonly TypeDeclarationStatement[],
  candidates: readonly { node: ComponentFunction }[],
  keys: readonly AST.TSType[] = [],
): ModuleTypes {
  const table = new TypeTable(declarations);
  const reached = new Set<string>();
  // An injection key's type is copied as the setup's types are, into the output that declares
  // the key (ADR-0054).
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
 * annotation (ADR-0045): every type its body writes, in source order.
 */
export function setupTypes(fn: ComponentFunction, table: TypeTable): string[] {
  return closure([fn.params.slice(1), fn.body], table);
}

/**
 * The names of the module's type declarations a type, or the types in a node, reach through
 * every reference in it and in the declarations it reaches, in source order.
 */
export function closure(type: unknown, table: TypeTable): string[] {
  const found = new Set<string>();
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const typed = node as { type?: string; typeName?: { type: string; name?: string } };
    if (typed.type === "TSTypeReference" && typed.typeName?.type === "Identifier") {
      const name = typed.typeName.name!;
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
 * Checks a top-level type declaration: declared once, generic-free, without `extends`, holding
 * no text that would end a script block or Astro's frontmatter, named apart from the types the
 * outputs declare, reached by some component's props, and holding only types props can have.
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
    reporter.unsupported(
      id,
      `\`${name}\` is not used by any component: types that a module exports on their own land in M5.`,
      {
        help: "Use the type in a component's props or code, or move it to a `.ts` module once M5 lands.",
      },
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
  if (node.typeParameters) {
    reporter.unsupported(
      node.typeParameters,
      "Generic types are not supported in props yet: they land in M5.",
    );
  }
  if (node.type === "TSInterfaceDeclaration" && node.extends.length) {
    reporter.unsupported(
      node.extends[0]!,
      "Interfaces that extend others are not supported in props yet: they land in M5.",
      { help: "Write the members in the interface itself." },
    );
  }
  checkCopiedText({ start: node.start, end: node.end }, source, reporter, "A type declaration");
  checkDirectives({ start: node.start, end: node.end }, comments, reporter);
  if (node.type === "TSInterfaceDeclaration") {
    checkMembers(node.body.body, types, reporter);
  } else {
    checkType(node.typeAnnotation, types, reporter);
  }
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

/** Checks the members of an interface or an object type literal (ADR-0034). */
export function checkMembers(
  members: readonly AST.TSSignature[],
  types: ModuleTypes,
  reporter: Reporter,
): void {
  const names = new Set<string>();
  for (const member of members) {
    switch (member.type) {
      case "TSPropertySignature": {
        const name = member.computed ? undefined : memberName(member.key);
        if (name === undefined) {
          report(
            types,
            reporter,
            "UF1002",
            member.key,
            "Computed keys in props types are not supported yet: they land in M5.",
          );
          continue;
        }
        // TypeScript rejects it (TS2300), and the outputs would declare the prop twice.
        if (names.has(name)) {
          report(
            types,
            reporter,
            "UF2001",
            member.key,
            `\`${name}\` is declared twice in this type: TypeScript rejects the second, and every target would declare it twice.`,
            "Declare it once.",
          );
          continue;
        }
        names.add(name);
        const type = member.typeAnnotation?.typeAnnotation;
        if (!type) {
          report(types, reporter, "UF1002", member, "A member of a props type needs a type.");
          continue;
        }
        checkType(type, types, reporter);
        break;
      }
      case "TSMethodSignature":
      case "TSCallSignatureDeclaration":
      case "TSConstructSignatureDeclaration":
        report(types, reporter, "UF1002", member, FUNCTIONS);
        break;
      case "TSIndexSignature":
        report(
          types,
          reporter,
          "UF1002",
          member,
          "Index signatures are not supported in props types yet: they land in M5.",
        );
        break;
    }
  }
}

const FUNCTIONS =
  "Function types are not supported in props: a callback is an event, which a component declares with `defineEmits` (ADR-0047), and a render function is a slot (`defineSlots`).";

/** Checks a member's type: the types every target's props can declare (ADR-0034). */
export function checkType(type: AST.TSType, types: ModuleTypes, reporter: Reporter): void {
  const later = (what: string) =>
    report(
      types,
      reporter,
      "UF1002",
      type,
      `${what} is not supported in props yet: it lands in M5.`,
    );
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
        if (literal.expressions.length) later("A template literal type");
        return;
      }
      if (literal.type === "Literal" && typeof literal.value === "bigint") later("A BigInt type");
      return;
    }
    case "TSUnionType":
      for (const member of type.types) checkType(member, types, reporter);
      return;
    case "TSArrayType":
      checkType(type.elementType, types, reporter);
      return;
    case "TSParenthesizedType":
      checkType(type.typeAnnotation, types, reporter);
      return;
    case "TSTypeOperator":
      if (type.operator === "readonly" && type.typeAnnotation.type === "TSArrayType") {
        checkType(type.typeAnnotation, types, reporter);
      } else {
        later(`\`${type.operator}\``);
      }
      return;
    case "TSTypeLiteral":
      if (!type.members.length) later("The empty object type `{}`");
      checkMembers(type.members, types, reporter);
      return;
    case "TSTypeReference": {
      const name = type.typeName.type === "Identifier" ? type.typeName.name : undefined;
      const argument = type.typeArguments?.params;
      if ((name === "Array" || name === "ReadonlyArray") && argument?.length === 1) {
        checkType(argument[0]!, types, reporter);
        return;
      }
      if (name !== undefined && !type.typeArguments && types.table.declaration(name)) return;
      report(
        types,
        reporter,
        "UF1002",
        type,
        name !== undefined && !type.typeArguments
          ? `\`${name}\` is not a type this module declares: global and imported types in props land in M5.`
          : "Utility, global and imported types in props land in M5.",
      );
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
      return later("A template literal type");
    case "TSIntersectionType":
      return later("An intersection type");
    default:
      return later("This type");
  }
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
