// A component's public API (ADR-0053, ADR-0055): what a parent reads of it, its props, events,
// slots, exposed functions and options, and the shape of its render root. It is read from the
// declarations alone, as written, so it is known before any component is lowered: a module's own
// components render each other, and the resolver gives a child's API without compiling the
// child or resolving the child's own children. The declarations' rules are the setup's and the
// props' to check (`./setup.ts`, `./props.ts`): a child whose API is wrong fails its own compile.

import type { ApiEvent, ApiMember, ApiSlot, ComponentApi } from "@unframework/ir";
import type { AST } from "@unframework/parser";
import { isComponentName } from "@unframework/parser";

import type { AuthoringApi } from "./authoring.ts";
import type { ComponentFunction } from "./render.ts";
import type { Scopes } from "./scope.ts";
import type { TypeTable } from "./types/from-type.ts";

/** What reading a component's API needs of its module. */
export interface ApiContext {
  readonly source: string;
  readonly scopes: Scopes;
  readonly types: TypeTable;
  /** The module's authoring imports, by the identifier that declares each. */
  readonly authoring: ReadonlyMap<object, AuthoringApi | undefined>;
}

/** A component of the module, as the API reads it. */
export interface ApiCandidate {
  readonly name: string;
  readonly node: ComponentFunction;
  /** How the module exports it: by its export kinds, none for a local component. */
  readonly exports: readonly { kind: "default" | "named" }[];
}

/** Reads a component's API from its declarations (ADR-0055). */
export function componentApi(candidate: ApiCandidate, context: ApiContext): ComponentApi {
  const { node } = candidate;
  const body = node.body?.type === "BlockStatement" ? node.body.body : [];
  const api: ComponentApi = {
    name: candidate.name,
    export: candidate.exports.some((entry) => entry.kind === "default")
      ? "default"
      : candidate.exports.length
        ? "named"
        : "local",
    props: propsOf(node, context),
    events: [],
    models: [],
    slots: [],
    exposes: [],
    inheritAttrs: true,
    root: "other",
  };
  for (const statement of body) {
    const call = macroCall(statement, context);
    if (!call) continue;
    const [type] = call.call.typeArguments?.params ?? [];
    switch (call.api) {
      case "defineEmits":
        api.events = type ? eventsOf(type, context) : [];
        break;
      case "defineSlots":
        api.slots = type ? slotsOf(type, context) : [];
        break;
      case "defineExpose":
        api.exposes = exposedOf(call.call);
        break;
      case "defineOptions":
        if (inheritsNothing(call.call)) api.inheritAttrs = false;
        break;
      default:
        break;
    }
  }
  const root = rootOf(node);
  api.root = root.kind;
  if (root.tag !== undefined) api.rootTag = root.tag;
  return api;
}

/** The authoring macro a top-level statement calls, as a statement or a `const`'s value. */
function macroCall(
  statement: AST.Statement,
  context: ApiContext,
): { api: AuthoringApi; call: AST.CallExpression } | undefined {
  const expression =
    statement.type === "ExpressionStatement"
      ? statement.expression
      : statement.type === "VariableDeclaration" && statement.declarations.length === 1
        ? statement.declarations[0]!.init
        : undefined;
  if (expression?.type !== "CallExpression" || expression.callee.type !== "Identifier") {
    return undefined;
  }
  const resolution = context.scopes.resolve(expression.callee);
  if (resolution.kind !== "import") return undefined;
  const api = context.authoring.get(resolution.declaration);
  return api ? { api, call: expression } : undefined;
}

/** The members of a type: a type literal's, or a local `interface`'s or `type`'s of one. */
export function typeMembers(
  type: AST.TSType,
  table: TypeTable,
): readonly AST.TSSignature[] | undefined {
  if (type.type === "TSTypeLiteral") return type.members;
  if (type.type !== "TSTypeReference" || type.typeName.type !== "Identifier" || type.typeArguments)
    return undefined;
  const declaration = table.declaration(type.typeName.name);
  if (!declaration) return undefined;
  const { node } = declaration;
  if (node.type === "TSInterfaceDeclaration") return node.body.body;
  return node.typeAnnotation.type === "TSTypeLiteral" ? node.typeAnnotation.members : undefined;
}

/** A member's name: an identifier's, or a string literal's. */
function keyName(member: AST.TSSignature): string | undefined {
  if (
    (member.type !== "TSPropertySignature" && member.type !== "TSMethodSignature") ||
    member.computed
  ) {
    return undefined;
  }
  const { key } = member;
  if (key.type === "Identifier") return key.name;
  return key.type === "Literal" && typeof key.value === "string" ? key.value : undefined;
}

const text = (node: { start: number; end: number }, context: ApiContext) =>
  context.source.slice(node.start, node.end);

/** The props: the members of the first parameter's type, in member order. */
function propsOf(node: ComponentFunction, context: ApiContext): ApiMember[] {
  const [parameter] = node.params;
  const annotation =
    parameter?.type === "Identifier" || parameter?.type === "ObjectPattern"
      ? parameter.typeAnnotation?.typeAnnotation
      : undefined;
  const members = annotation ? typeMembers(annotation, context.types) : undefined;
  return (members ?? []).flatMap((member) => {
    const name = keyName(member);
    if (name === undefined || member.type !== "TSPropertySignature") return [];
    const type = member.typeAnnotation?.typeAnnotation;
    return [{ name, optional: member.optional, type: type ? text(type, context) : "unknown" }];
  });
}

/** The events: each member a named tuple of its payload. */
function eventsOf(type: AST.TSType, context: ApiContext): ApiEvent[] {
  return (typeMembers(type, context.types) ?? []).flatMap((member) => {
    const name = keyName(member);
    const tuple = member.type === "TSPropertySignature" && member.typeAnnotation?.typeAnnotation;
    if (name === undefined || !tuple || tuple.type !== "TSTupleType") return [];
    return [
      {
        name,
        parameters: tuple.elementTypes.flatMap((element) =>
          element.type === "TSNamedTupleMember"
            ? [
                {
                  name: element.label.name,
                  ...(element.optional ? { optional: true as const } : {}),
                  type: text(element.elementType, context),
                },
              ]
            : [],
        ),
      },
    ];
  });
}

/** The slots: each an optional method, whose one parameter, when it has one, is its props. */
function slotsOf(type: AST.TSType, context: ApiContext): ApiSlot[] {
  return (typeMembers(type, context.types) ?? []).flatMap((member) => {
    const name = keyName(member);
    if (name === undefined) return [];
    const fn =
      member.type === "TSMethodSignature"
        ? member
        : member.type === "TSPropertySignature" &&
            member.typeAnnotation?.typeAnnotation.type === "TSFunctionType"
          ? member.typeAnnotation.typeAnnotation
          : undefined;
    if (!fn || (member.type !== "TSMethodSignature" && member.type !== "TSPropertySignature"))
      return [];
    const [parameter] = fn.params;
    const props =
      parameter?.type === "Identifier" ? parameter.typeAnnotation?.typeAnnotation : undefined;
    return [{ name, optional: member.optional, ...(props ? { props: text(props, context) } : {}) }];
  });
}

/** The names `defineExpose`'s object literal exposes, in shorthand. */
function exposedOf(call: AST.CallExpression): string[] {
  const [object] = call.arguments;
  if (object?.type !== "ObjectExpression") return [];
  return object.properties.flatMap((property) =>
    property.type === "Property" && property.shorthand && property.value.type === "Identifier"
      ? [property.value.name]
      : [],
  );
}

/** Whether `defineOptions` turns fallthrough off: `{ inheritAttrs: false }`. */
function inheritsNothing(call: AST.CallExpression): boolean {
  const [object] = call.arguments;
  const option = object?.type === "ObjectExpression" ? inheritAttrsOption(object) : undefined;
  return option?.value.type === "Literal" && option.value.value === false;
}

/**
 * The `inheritAttrs` member of `defineOptions`'s object, `inheritAttrs` or `"inheritAttrs"`:
 * the setup checks it (UF2031) and the API reads it by this one rule, so a parent's fallthrough
 * is judged by what the child's compile accepts.
 */
export function inheritAttrsOption(object: AST.ObjectExpression): AST.ObjectProperty | undefined {
  return object.properties.find(
    (property): property is AST.ObjectProperty =>
      property.type === "Property" &&
      !property.computed &&
      property.kind === "init" &&
      !property.method &&
      ((property.key.type === "Identifier" && property.key.name === "inheritAttrs") ||
        (property.key.type === "Literal" && property.key.value === "inheritAttrs")),
  );
}

/** What a component's returned JSX is: one element (with its tag), one component, or other. */
function rootOf(node: ComponentFunction): {
  kind: ComponentApi["root"];
  tag?: string;
} {
  const body = node.body;
  const statements =
    body?.type === "BlockStatement"
      ? body.body.filter((statement) => statement.type !== "EmptyStatement")
      : [];
  const last = statements.at(-1);
  let returned: AST.Expression | null | undefined =
    body && body.type !== "BlockStatement"
      ? body
      : last?.type === "ReturnStatement"
        ? last.argument
        : undefined;
  while (returned?.type === "ParenthesizedExpression") returned = returned.expression;
  if (returned?.type !== "JSXElement") return { kind: "other" };
  const name = returned.openingElement.name;
  if (name.type !== "JSXIdentifier") return { kind: "other" };
  if (isComponentName(name.name)) return { kind: "component" };
  if (name.name === "component") return { kind: "other" };
  return { kind: "element", tag: name.name };
}
