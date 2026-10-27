// A component's props (ADR-0034): its one parameter, destructured with static
// defaults or kept as one object, typed by an object type the module declares or writes inline,
// or one the type oracle resolves (ADR-0067): imported, extended, intersected or built with a
// utility type. The props are the type's members, in member order; each gets a binding
// expressions read it through, and the kinds of value it can have.

import type { DiagnosticCode } from "@unframework/diagnostics";
import {
  createBinding,
  createExpression,
  createProp,
  createPropsParameter,
  createTypeText,
  isIdentifier,
  reservedPropName,
  reservedPropsParameterName,
} from "@unframework/ir";
import type { Binding, DeclaredBy, Prop, PropsParameter, Span, TypeText } from "@unframework/ir";
import { visitorKeys } from "@unframework/parser";
import type { AST, ParsedModule } from "@unframework/parser";
import type { ObjectNode, ShapeMember, TypeShape, UnresolvedType } from "@unframework/type-oracle";

import type { Reporter } from "./context.ts";
import {
  checkCopiedText,
  checkMembers,
  closure,
  declaredTwice,
  FUNCTIONS,
  needsChecker,
  notAProp,
  report,
  undeclared,
} from "./declarations.ts";
import type { ModuleTypes } from "./declarations.ts";
import { checkDirectives, span } from "./expressions.ts";
import type { ComponentFunction, PropBinding } from "./render.ts";
import type { Shapes } from "./shapes.ts";
import { kindsFromShape } from "./types/from-shape.ts";
import { memberName } from "./types/from-type.ts";
import { has, union, UNDEFINED, without } from "./types/kinds.ts";
import type { Kinds } from "./types/kinds.ts";

/** What a component's props parameter declares. */
export interface PropsAnalysis {
  props: Prop[];
  propsParameter: PropsParameter | undefined;
  /** The props' bindings, in source order. */
  bindings: Binding[];
  /** The names of the module's types the props reach, in source order. */
  types: string[];
  byName: Map<string, PropBinding>;
  byDeclaration: Map<object, PropBinding>;
  object: { declaration: object; name: string } | undefined;
  /**
   * Whether the props have a problem: one in a type the component shares with another is
   * reported once, so the reporter alone cannot tell.
   */
  failed: boolean;
}

/** A member of the props type, as the props are built from it. */
interface PropMember {
  name: string;
  optional: boolean;
  /** Where its key is written in this module: a problem with its name is reported there. */
  key: Span;
  /** Its type's text, as the prop holds it. */
  type: TypeText;
  /** Where a problem with its type is reported, in this module. */
  at: Span;
  /** The prop's span. */
  span: Span;
  kinds: Kinds;
  declaredBy?: DeclaredBy;
}

/** Analyses a component's parameters as its props, reporting what no target can declare. */

export function analyzeProps(
  fn: ComponentFunction,
  types: ModuleTypes,
  shapes: Shapes,
  parsed: ParsedModule,
  reporter: Reporter,
): PropsAnalysis {
  const { source, comments } = parsed;
  const result: PropsAnalysis = {
    props: [],
    propsParameter: undefined,
    bindings: [],
    types: [],
    byName: new Map(),
    byDeclaration: new Map(),
    object: undefined,
    failed: false,
  };
  const mark = reporter.diagnostics.length;
  const [parameter, ...others] = fn.params;
  if (!parameter) return result;
  if (others.length) {
    reporter.report(
      "UF2001",
      { start: others[0]!.start, end: others.at(-1)!.end },
      "A component takes one parameter, its props.",
      { help: "Declare every prop as a member of the props type." },
    );
  }
  if (parameter.type === "TSParameterProperty") return result;
  if (parameter.type !== "Identifier" && parameter.type !== "ObjectPattern") {
    reporter.report(
      "UF2001",
      parameter,
      parameter.type === "AssignmentPattern"
        ? "The props parameter cannot have a default: give each optional prop its own."
        : "The props parameter is destructured as an object, or kept as one object.",
      { help: 'Write `({ label, tone = "info" }: Props)` or `(props: Props)`.' },
    );
    return result;
  }
  const annotation = parameter.typeAnnotation?.typeAnnotation;
  if (!annotation) {
    reporter.report("UF2001", parameter, "The props parameter needs a type annotation.", {
      help: "Annotate it with an object type: `({ label }: { label: string })`, or an interface the module declares.",
    });
    return result;
  }
  if (parameter.type === "Identifier" && !isIdentifier(parameter.name)) {
    reporter.unsupported(
      { start: parameter.start, end: parameter.start + parameter.name.length },
      `\`${parameter.name}\` is not written in ASCII letters, digits, \`_\` and \`$\`: Angular's expression lexer reads no other.`,
      { help: "Rename the parameter." },
    );
  } else if (parameter.type === "Identifier" && reservedPropsParameterName(parameter.name)) {
    reporter.report(
      "UF2001",
      { start: parameter.start, end: parameter.start + parameter.name.length },
      `\`${parameter.name}\` cannot name the props parameter: ${reservedPropsParameterName(parameter.name)!}.`,
      { help: "Rename the parameter: `props`." },
    );
  }
  if (parameter.type === "Identifier" && parameter.optional) {
    reporter.report(
      "UF2001",
      parameter,
      "The props parameter cannot be optional: a component always receives its props.",
      { help: "Remove the `?`, and make the props themselves optional." },
    );
  }
  checkDirectives(span(annotation), comments, reporter);
  // The outputs copy the annotation as written, as they copy a type declaration.
  checkCopiedText(span(annotation), source, reporter, "A props type");
  const members = types.shapedAnnotations.has(annotation)
    ? shapeMembers(annotation, types, shapes, parsed, reporter)
    : propsMembers(annotation, types, source, reporter);
  if (!members) {
    result.failed = true;
    return result;
  }
  const object = parameter.type === "Identifier";
  result.types = closure(annotation, types.table);
  result.propsParameter = createPropsParameter(
    object ? "object" : "destructured",
    createTypeText(source.slice(annotation.start, annotation.end), span(annotation)),
    span(parameter),
    object ? parameter.name : undefined,
  );

  const pattern =
    parameter.type === "ObjectPattern" ? destructured(parameter, members, reporter) : undefined;
  const at = object
    ? { start: parameter.start, end: parameter.start + parameter.name.length }
    : undefined;
  if (object) result.object = { declaration: parameter, name: parameter.name };
  const names = new Set<string>();
  for (const member of members) {
    const { name } = member;
    // A member declared twice is reported where its type is checked (UF2001), once for every
    // component that shares the type: each prop is declared once.
    if (names.has(name)) {
      result.failed = true;
      continue;
    }
    names.add(name);
    const reserved = reservedPropName(name);
    if (reserved) {
      result.failed = true;
      report(
        types,
        reporter,
        "UF2003",
        member.key,
        `\`${name}\` cannot be a prop's name: ${reserved}`,
        "Rename the prop.",
      );
    }
    const declared = member.kinds;
    if (castsToTrue(declared, name)) {
      result.failed = true;
      report(
        types,
        reporter,
        "UF1002",
        member.at,
        'Props that can be both a boolean and any string, `""` or the prop\'s own name are not supported yet: Vue reads `""` and the prop\'s own name as `true`. They land in M5.',
        'Type the strings as literals other than `""` and the prop\'s name, as in `boolean | "mixed"`.',
      );
    }
    const property = pattern?.get(name);
    const value = property?.value;
    const assigned = value?.type === "AssignmentPattern" ? value : undefined;
    const declaration = assigned ? assigned.left : value;
    let defaultValue: AST.Expression | undefined;
    if (assigned) {
      defaultValue = checkDefault(assigned.right, member, declared, source, comments, reporter);
    }
    const kinds =
      defaultValue !== undefined
        ? without(declared, "undefined")
        : member.optional
          ? union(declared, UNDEFINED)
          : declared;
    const binding =
      object && at
        ? createBinding(name, "prop", at)
        : declaration?.type === "Identifier"
          ? createBinding(name, "prop", span(declaration))
          : undefined;
    if (binding) result.bindings.push(binding);
    const prop: PropBinding = { name, id: binding?.id, kinds };
    result.byName.set(name, prop);
    if (declaration?.type === "Identifier") result.byDeclaration.set(declaration, prop);
    result.props.push(
      createProp(
        name,
        member.optional,
        member.type,
        member.span,
        binding?.id,
        defaultValue
          ? createExpression(source.slice(defaultValue.start, defaultValue.end), span(defaultValue))
          : undefined,
        member.declaredBy,
      ),
    );
  }
  result.bindings.sort((a, b) => a.span.start - b.span.start);
  if (reporter.hasErrorsSince(mark)) result.failed = true;
  return result;
}

/**
 * The members of a props type the module's syntax reads (`readsSyntax`): an object type
 * literal, or a reference to a local interface or to an alias of either, followed through
 * aliases.
 */
function propsMembers(
  annotation: AST.TSType,
  types: ModuleTypes,
  source: string,
  reporter: Reporter,
): PropMember[] | undefined {
  const seen = new Set<string>();
  let type: AST.TSType = annotation;
  let signatures: readonly AST.TSSignature[] | undefined;
  for (;;) {
    if (type.type === "TSTypeLiteral") {
      // An inline literal is checked here; a declaration where it is declared.
      if (type === annotation) checkMembers(type.members, types, reporter);
      signatures = type.members;
      break;
    }
    if (type.type === "TSParenthesizedType") {
      type = type.typeAnnotation;
      continue;
    }
    const name =
      type.type === "TSTypeReference" && type.typeName.type === "Identifier" && !type.typeArguments
        ? type.typeName.name
        : undefined;
    const declaration = name === undefined ? undefined : types.table.declaration(name);
    // `readsSyntax` admits only a chain that ends in an object type.
    if (!declaration || seen.has(name!)) return undefined;
    seen.add(name!);
    if (declaration.node.type === "TSInterfaceDeclaration") {
      signatures = declaration.node.body.body;
      break;
    }
    type = declaration.node.typeAnnotation;
  }
  return signatures.flatMap((member): PropMember[] => {
    if (member.type !== "TSPropertySignature" || member.computed) return [];
    const name = memberName(member.key);
    const written = member.typeAnnotation?.typeAnnotation;
    if (name === undefined || !written) return [];
    return [
      {
        name,
        optional: member.optional,
        key: span(member.key),
        type: createTypeText(source.slice(written.start, written.end), span(written)),
        at: span(written),
        span: span(member),
        kinds: types.table.kindsOf(written),
      },
    ];
  });
}

/** Reports a problem of a props type, and fails the component it was found for. */
type Problem = (code: DiagnosticCode, at: Span, message: string, help?: string) => void;

/**
 * The members of a props type read from its shape (ADR-0067): one the module imports, extends,
 * intersects, or builds with a utility type. A member another file writes is reported at the
 * props annotation, the one span of it this module holds, and its prop takes the annotation's
 * span and the declaring file's text, with `declaredBy` naming where it is written. So does a
 * member of another declaration of this module, at its own span. A problem of a type that
 * components share is reported once, and fails each of them.
 */
function shapeMembers(
  annotation: AST.TSType,
  types: ModuleTypes,
  shapes: Shapes,
  parsed: ParsedModule,
  reporter: Reporter,
): PropMember[] | undefined {
  const at = span(annotation);
  const shape = shapes(at);
  if (!shape) {
    // `compile()` asks its oracle for every props annotation (`shapeQueries`); an oracle that
    // failed is reported there.
    reporter.report("UF6001", at, "The type oracle gave no shape for this props type.", {
      help: "Give `analyze` the shape of every type `shapeQueries` names.",
    });
    return undefined;
  }
  let failed = false;
  const problem: Problem = (code, where, message, help) => {
    failed = true;
    report(types, reporter, code, where, message, help);
  };
  const { file, source } = parsed;
  const here = (entry: { file: string; span: Span }) => (entry.file === file ? entry.span : at);
  const textOf = (entry: UnresolvedType) => {
    if (entry.file === file) return source.slice(entry.span.start, entry.span.end);
    const node = shape.nodes.find(
      (each) =>
        each.kind === "opaque" &&
        each.file === entry.file &&
        each.span.start === entry.span.start &&
        each.span.end === entry.span.end,
    );
    return node?.kind === "opaque" ? node.text : "a type";
  };
  const root = shape.nodes[shape.root]!;
  const members = root.kind === "object" ? root.members : [];
  // The members two declarations type differently, each with the declarations that write it.
  const conflicting = root.kind === "object" ? overrides(shape, root) : new Map();
  for (const entry of shape.unresolved) {
    const text = code(textOf(entry));
    const where = entry.file === file ? "" : ` in \`${entry.file}\``;
    switch (entry.reason) {
      case "missing-module":
        problem(
          "UF6001",
          here(entry),
          `${text}${where} cannot be resolved: the type oracle cannot read the module it is imported from.`,
          "Check the import's path, and that the package ships its types.",
        );
        break;
      case "missing-export":
        problem(
          "UF6001",
          here(entry),
          `${text}${where} cannot be resolved: the module it is imported from does not export it.`,
          "Check the name, and export the type from its module.",
        );
        break;
      case "external":
        problem(
          "UF6001",
          here(entry),
          `${text} is imported, and without the compiler's shapes the analyser reads only this module's types.`,
          "Compile the module with `compile()`, whose type oracle resolves imported types.",
        );
        break;
      case "unsupported":
        problem("UF6002", here(entry), ...needsChecker(`${text}${where}`));
        break;
      case "conflict": {
        const member = members.find(
          (each) =>
            each.file === entry.file &&
            each.typeText?.span.start === entry.span.start &&
            each.typeText.span.end === entry.span.end,
        );
        if (member) {
          if (!conflicting.has(member.name))
            conflicting.set(member.name, declarers(shape, member.name));
        } else {
          problem(
            "UF6005",
            at,
            `Two declarations give ${text}${where} different types: the targets declare each prop once, with one type.`,
            "Declare the member once, or give both declarations the same type and optionality.",
          );
        }
        break;
      }
    }
  }
  for (const [name, by] of conflicting) {
    const list = [...by];
    problem(
      "UF6005",
      at,
      `\`${name}\` is declared with different types or optionality${list.length > 1 ? ` by ${list.slice(0, -1).join(", ")} and ${list.at(-1)!}` : ""}: the targets declare each prop once, with one type.`,
      "Declare the member once, or give both declarations the same type and optionality.",
    );
  }
  if (root.kind !== "object") {
    if (root.kind === "opaque") {
      if (!shape.unresolved.length) problem("UF6001", at, ...undeclared(root.text));
    } else {
      problem(
        "UF6004",
        at,
        `The props type resolves to ${describeNode(shape, shape.root)}, not to an object type: the targets declare the members of one object type as props.`,
        "Give the component one object type of props. Write alternatives as optional members, or as a member whose literal union says which applies.",
      );
    }
    return undefined;
  }
  duplicates(annotation, types, problem);
  // The props type's own declaration, when the annotation names one of this module: its members
  // are the type's own, and every other declaration's are another's (`declaredBy`).
  const own =
    annotation.type === "TSTypeReference" && annotation.typeName.type === "Identifier"
      ? annotation.typeName.name
      : undefined;
  const signatures = signaturesOf(parsed.program);
  const keyOf = (member: ShapeMember): Span =>
    member.file === file ? span(signatures.get(member.span.start)?.key ?? member.span) : at;
  const result: PropMember[] = [];
  for (const member of members) {
    const local = member.file === file;
    // A member another file writes always belongs to a named declaration: a file is reached only
    // through an import of a type by its name.
    const declaredBy: DeclaredBy | undefined =
      !local || (member.declaration && member.declaration.name !== own)
        ? { file: member.file, declaration: member.declaration!.name, span: member.span }
        : undefined;
    const where = local ? (member.typeText?.span ?? member.span) : at;
    checkShapeType(shape, member.type, where, problem, new Set());
    checkExported(shape, member, at, file, problem);
    result.push({
      name: member.name,
      optional: member.optional,
      key: keyOf(member),
      type: local
        ? createTypeText(member.typeText?.code ?? "", member.typeText?.span ?? member.span)
        : createTypeText(member.typeText?.code ?? "", at),
      at: where,
      span: local ? member.span : at,
      kinds: kindsFromShape(shape, keyOf, member.type),
      ...(declaredBy ? { declaredBy } : {}),
    });
  }
  return failed ? undefined : result;
}

/** Code as a message quotes it: in backticks, or double ones around text that holds one. */
function code(text: string): string {
  return text.includes("`") ? `\`\` ${text} \`\`` : `\`${text}\``;
}

/**
 * The members of a props type that two of the declarations it is built from write with
 * different types, or optional in one and required in the other (UF6005): an interface's member
 * over its base's, or two parts of an intersection. The oracle keeps an interface's own member,
 * and merges optionality as TypeScript does; the targets declare one type for each prop, so the
 * catalogue holds the declarations to one. A utility type or a generic instantiation changes its
 * members on purpose, so its shape is left to the oracle's own conflicts.
 */
function overrides(shape: TypeShape, root: ObjectNode): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();
  if (shape.construction.some((each) => each.startsWith("utility:") || each === "generic")) {
    return found;
  }
  // The objects the members' types reach are values of the props, not parts of their type.
  const values = new Set<number>();
  const reach = (id: number): void => {
    if (values.has(id)) return;
    values.add(id);
    const node = shape.nodes[id]!;
    switch (node.kind) {
      case "union":
        for (const each of node.types) reach(each);
        return;
      case "array":
        reach(node.element);
        return;
      case "tuple":
        for (const each of node.elements) reach(each.type);
        return;
      case "object":
        for (const member of node.members) reach(member.type);
        return;
      case "function":
        for (const parameter of node.parameters) reach(parameter.type);
        reach(node.returns);
        return;
      case "typeParameter":
        if (node.constraint !== undefined) reach(node.constraint);
        return;
      default:
        return;
    }
  };
  for (const member of root.members) reach(member.type);
  for (const [id, node] of shape.nodes.entries()) {
    if (id === shape.root || values.has(id) || node.kind !== "object" || !node.declaration) {
      continue;
    }
    for (const part of node.members) {
      const merged = root.members.find((member) => member.name === part.name);
      if (!merged) continue;
      if (merged.optional === part.optional && sameType(shape, merged.type, part.type, new Set())) {
        continue;
      }
      const by = found.get(part.name) ?? new Set<string>();
      by.add(declarer(merged));
      by.add(declarer(part));
      found.set(part.name, by);
    }
  }
  return found;
}

/** The declarations of the shape's objects that write a member, as a message names them. */
function declarers(shape: TypeShape, name: string): Set<string> {
  const found = new Set<string>();
  for (const node of shape.nodes) {
    if (node.kind !== "object") continue;
    for (const member of node.members) if (member.name === name) found.add(declarer(member));
  }
  return found;
}

function declarer(member: ShapeMember): string {
  return member.declaration ? `\`${member.declaration.name}\`` : "an object type written in place";
}

/** Whether two nodes of a shape are one type, as far as the shape can tell. */
function sameType(shape: TypeShape, a: number, b: number, seen: Set<string>): boolean {
  if (a === b) return true;
  const key = `${a}:${b}`;
  if (seen.has(key)) return true;
  seen.add(key);
  const left = shape.nodes[a]!;
  const right = shape.nodes[b]!;
  const same = (x: number, y: number) => sameType(shape, x, y, seen);
  switch (left.kind) {
    case "primitive":
      return right.kind === "primitive" && left.name === right.name;
    case "literal":
      return right.kind === "literal" && left.value === right.value;
    case "union":
      return (
        right.kind === "union" &&
        left.types.length === right.types.length &&
        left.types.every((x) => right.types.some((y) => same(x, y)))
      );
    case "array":
      return (
        right.kind === "array" &&
        left.readonly === right.readonly &&
        same(left.element, right.element)
      );
    case "tuple":
      return (
        right.kind === "tuple" &&
        left.elements.length === right.elements.length &&
        left.elements.every((element, index) => {
          const other = right.elements[index]!;
          return (
            element.optional === other.optional &&
            element.rest === other.rest &&
            same(element.type, other.type)
          );
        })
      );
    case "object":
      if (right.kind !== "object") return false;
      if (left.declaration && right.declaration && !left.typeArguments && !right.typeArguments) {
        return (
          left.declaration.file === right.declaration.file &&
          left.declaration.name === right.declaration.name
        );
      }
      return (
        left.members.length === right.members.length &&
        left.members.every((member) => {
          const other = right.members.find((each) => each.name === member.name);
          return (
            other !== undefined &&
            other.optional === member.optional &&
            same(member.type, other.type)
          );
        })
      );
    case "function":
      return (
        right.kind === "function" &&
        left.parameters.length === right.parameters.length &&
        left.parameters.every((parameter, index) =>
          same(parameter.type, right.parameters[index]!.type),
        ) &&
        same(left.returns, right.returns)
      );
    case "typeParameter":
      return right.kind === "typeParameter" && left.name === right.name;
    case "opaque":
      return right.kind === "opaque" && left.text === right.text;
  }
}

/**
 * Reports a member written twice in one of the objects this module writes that a props type
 * reaches (UF2001): the oracle keeps one, but each output copies the declaration as written,
 * which TypeScript rejects (TS2300), as `checkMembers` reports for a type the syntax reads.
 */
function duplicates(annotation: AST.TSType, types: ModuleTypes, problem: Problem): void {
  const check = (signatures: readonly AST.TSSignature[]) => {
    const names = new Set<string>();
    for (const member of signatures) {
      if (member.type !== "TSPropertySignature" && member.type !== "TSMethodSignature") continue;
      const name = member.computed ? undefined : memberName(member.key);
      if (name === undefined) continue;
      if (names.has(name)) problem("UF2001", span(member.key), ...declaredTwice(name));
      names.add(name);
    }
  };
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const typed = node as AST.Node;
    if (typeof typed.type !== "string") return;
    if (typed.type === "TSTypeLiteral") check(typed.members);
    if (typed.type === "TSInterfaceBody") check(typed.body);
    for (const key of visitorKeys[typed.type] ?? []) {
      visit((node as unknown as Record<string, unknown>)[key]);
    }
  };
  visit(annotation);
  for (const name of closure(annotation, types.table)) visit(types.table.declaration(name)!.node);
}

/**
 * Checks a member's resolved type as `checkType` checks one written in the module (ADR-0034),
 * reporting at `at`: what the type oracle could not resolve is reported where it met it.
 */
function checkShapeType(
  shape: TypeShape,
  id: number,
  at: Span,
  problem: Problem,
  seen: Set<number>,
): void {
  const node = shape.nodes[id]!;
  switch (node.kind) {
    case "primitive":
      if (!["string", "number", "boolean", "null", "undefined"].includes(node.name)) {
        problem("UF6002", at, ...notAProp(`\`${node.name}\``));
      }
      return;
    case "literal":
      return;
    case "union":
      for (const each of node.types) checkShapeType(shape, each, at, problem, seen);
      return;
    case "array":
      checkShapeType(shape, node.element, at, problem, seen);
      return;
    case "tuple":
      problem("UF6002", at, ...notAProp("A tuple type"));
      return;
    case "object":
      if (seen.has(id)) return;
      seen.add(id);
      if (!node.declaration && !node.members.length) {
        problem("UF6002", at, ...notAProp("The empty object type `{}`"));
      }
      for (const member of node.members) checkShapeType(shape, member.type, at, problem, seen);
      return;
    case "function":
      problem("UF1002", at, FUNCTIONS);
      return;
    case "typeParameter":
      // Only a generic component's props name a type parameter, and it is reported itself.
      return;
    case "opaque": {
      const unresolved = shape.unresolved.some(
        (entry) =>
          entry.file === node.file &&
          entry.span.start === node.span.start &&
          entry.span.end === node.span.end,
      );
      // An unresolved one is reported with the shape; any other is a global type.
      if (!unresolved) problem("UF6001", at, ...undeclared(node.text));
    }
  }
}

/**
 * Reports a member another file writes whose type names a type that file does not export
 * (UF6003): an output that prints the member's type must import what it names (ADR-0067).
 */
function checkExported(
  shape: TypeShape,
  member: ShapeMember,
  at: Span,
  file: string,
  problem: Problem,
): void {
  if (member.file === file) return;
  for (const name of member.references) {
    const hidden = shape.nodes.some(
      (node) =>
        node.kind === "object" &&
        node.declaration?.file === member.file &&
        node.declaration.name === name &&
        !node.declaration.exported,
    );
    if (!hidden) continue;
    problem(
      "UF6003",
      at,
      `\`${member.name}\`'s type names \`${name}\`, which \`${member.file}\` declares without \`export\`: an output that writes the prop's type cannot import it.`,
      `Export \`${name}\` from \`${member.file}\`.`,
    );
  }
}

/** What a resolved type is, for UF6004's message. */
function describeNode(shape: TypeShape, id: number): string {
  const node = shape.nodes[id]!;
  switch (node.kind) {
    case "primitive":
      return `\`${node.name}\``;
    case "literal":
      return `the literal \`${JSON.stringify(node.value)}\``;
    case "union":
      return "a union";
    case "array":
    case "tuple":
      return "an array";
    case "function":
      return "a function";
    case "typeParameter":
      return `the type parameter \`${node.name}\``;
    default:
      return "a type";
  }
}

/** The module's property signatures, by where each starts: a member's key is read there. */
function signaturesOf(program: AST.Program): Map<number, AST.TSPropertySignature> {
  const found = new Map<number, AST.TSPropertySignature>();
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const typed = node as AST.Node;
    if (typeof typed.type !== "string") return;
    if (typed.type === "TSPropertySignature") found.set(typed.start, typed);
    for (const key of visitorKeys[typed.type] ?? []) {
      visit((node as unknown as Record<string, unknown>)[key]);
    }
  };
  visit(program);
  return found;
}

/** Checks a destructured props pattern, and returns its properties by prop name. */
function destructured(
  pattern: AST.ObjectPattern,
  members: readonly PropMember[],
  reporter: Reporter,
): Map<string, AST.BindingProperty> {
  const properties = new Map<string, AST.BindingProperty>();
  for (const property of pattern.properties) {
    if (property.type === "RestElement") {
      reporter.report(
        "UF2001",
        property,
        "Rest props (`...rest`) are not props: a component's fallthrough is its `class` and `style`, which merge into its root (ADR-0054).",
        { help: "Destructure each prop by its name." },
      );
      continue;
    }
    const name = property.computed ? undefined : memberName(property.key);
    if (property.computed || property.key.type !== "Identifier" || name === undefined) {
      reporter.report(
        "UF2001",
        property.key,
        "The props pattern destructures each prop by its name: no computed or string keys.",
      );
      continue;
    }
    const value =
      property.value.type === "AssignmentPattern" ? property.value.left : property.value;
    if (value.type !== "Identifier") {
      reporter.report(
        "UF2001",
        value,
        `Nested patterns in the props are not supported: destructure \`${name}\`, and read its members (\`${name}.member\`).`,
      );
      continue;
    }
    if (value.name !== name) {
      reporter.report(
        "UF2001",
        property,
        `\`${name}: ${value.name}\` renames a prop: destructure it by its own name, which the targets declare.`,
        { help: `Write \`${name}\`, and read it as \`${name}\`.` },
      );
      continue;
    }
    if (!members.some((member) => member.name === name)) {
      reporter.report("UF2001", property.key, `\`${name}\` is not a member of the props type.`, {
        help: "Declare it in the props type, or remove it from the pattern.",
      });
      continue;
    }
    properties.set(name, property);
  }
  return properties;
}

/**
 * Checks a prop's default (ADR-0034) and returns it when it is valid: on an optional prop,
 * `null` on one whose type admits `null` (Qwik applies a destructured default to `null` too),
 * and static (UF2002): a literal, a negated number, a template literal without expressions, or
 * an array or object literal of those.
 */
function checkDefault(
  value: AST.Expression,
  member: PropMember,
  declared: Kinds,
  source: string,
  comments: readonly AST.Comment[],
  reporter: Reporter,
): AST.Expression | undefined {
  const { name } = member;
  const mark = reporter.diagnostics.length;
  if (!member.optional) {
    reporter.report("UF2001", value, `\`${name}\` is required, so its default would never apply.`, {
      help: `Make it optional (\`${name}?:\`), or remove the default.`,
    });
  } else if (has(declared, "null") && !(value.type === "Literal" && value.value === null)) {
    reporter.report(
      "UF2001",
      value,
      `\`${name}\` can be \`null\`, and Qwik applies a destructured default to \`null\` too: its default can only be \`null\`.`,
      { help: "Remove the default, or remove `null` from the prop's type." },
    );
  }
  if (!isStatic(value)) {
    reporter.report(
      "UF2002",
      value,
      "A prop's default must be a static value: Vue hoists defaults out of the component, and Angular reads them before any input is set.",
      { help: "Write the value itself: a literal, or an array or object of literals." },
    );
  }
  checkCopiedText(span(value), source, reporter, "A prop's default");
  checkDirectives(span(value), comments, reporter);
  return reporter.hasErrorsSince(mark) ? undefined : value;
}

/**
 * Whether a default is static (ADR-0034): a prop's, and a parameter's of a function the setup
 * writes (ADR-0045), which the outputs evaluate where they declare it.
 */
export function isStatic(node: AST.Expression): boolean {
  switch (node.type) {
    case "Literal":
      return !("regex" in node && node.regex) && !("bigint" in node && node.bigint !== undefined);
    case "UnaryExpression":
      return (
        node.operator === "-" &&
        node.argument.type === "Literal" &&
        typeof node.argument.value === "number"
      );
    case "TemplateLiteral":
      return !node.expressions.length;
    case "ArrayExpression":
      return node.elements.every(
        (element) => element !== null && element.type !== "SpreadElement" && isStatic(element),
      );
    case "ObjectExpression":
      return node.properties.every(
        (property) =>
          property.type === "Property" &&
          property.kind === "init" &&
          !property.method &&
          !property.computed &&
          !property.shorthand &&
          (property.key.type === "Identifier" ||
            (property.key.type === "Literal" && typeof property.key.value === "string")) &&
          isStatic(property.value),
      );
    default:
      return false;
  }
}

/**
 * Whether Vue may read a value of a prop as `true` (ADR-0034): it declares a prop that can be a
 * boolean and a string as `[Boolean, String]`, and casts `""` and the prop's own name in kebab
 * case to `true`. A union of string literals that holds neither renders as the others do.
 */
function castsToTrue(declared: Kinds, name: string): boolean {
  if (!has(declared, "boolean") || !has(declared, "string")) return false;
  const { strings } = declared;
  const kebab = name.replaceAll(/\B([A-Z])/g, "-$1").toLowerCase();
  return !strings || strings.has("") || strings.has(kebab);
}
