// A component's public API (ADR-0053, ADR-0055): what a parent reads of it, its props, events,
// slots, exposed functions and options, and the shape of its render root. It is read from the
// declarations alone, as written, so it is known before any component is lowered: a module's own
// components render each other, and the resolver gives a child's API without compiling the
// child or resolving the child's own children. The declarations' rules are the setup's and the
// props' to check (`./setup.ts`, `./props.ts`): a child whose API is wrong fails its own compile.

import type { ApiEvent, ApiMember, ApiSlot, ComponentApi } from "@unframework/ir";
import type { AST } from "@unframework/parser";
import { isComponentName, parseModule } from "@unframework/parser";
import { printShape } from "@unframework/type-oracle";
import type { ShapeMember, TypeShape } from "@unframework/type-oracle";

import type { AuthoringApi } from "./authoring.ts";
import { spellsLiterals } from "./cross-component.ts";
import type { ComponentFunction } from "./render.ts";
import type { Scopes } from "./scope.ts";
import type { Shapes } from "./shapes.ts";

/** What reading a component's API needs of its module. */
export interface ApiContext extends MembersContext {
  readonly scopes: Scopes;
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
      case "defineModel": {
        const model = modelOf(call.call, context);
        if (model && !api.models.some((each) => each.name === model.name)) api.models.push(model);
        break;
      }
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

/**
 * A member of a type, as the API reads it (ADR-0067): its signature, parsed on its own from its
 * text, and the source the signature's offsets index. A member of the module is its own text; a
 * member another file writes is rebuilt from its name and its type as written there, or as the
 * oracle prints it for a method, whose text a shape does not hold.
 */
export interface TypeMember {
  readonly signature: AST.TSSignature;
  readonly source: string;
  /** The member's resolved type, in its shape. */
  readonly shape: TypeShape;
  readonly type: number;
}

/** What reading a type's members needs of its module. */
export interface MembersContext {
  readonly source: string;
  /** The module's file, as the shapes name it. */
  readonly file: string;
  readonly shapes: Shapes;
}

/**
 * The members of a type, read from its shape (ADR-0067): a type literal's, an interface's or an
 * alias's, with what `extends`, intersections and the utility types bring in, from this module or
 * from the files it imports. `undefined` when the type has no shape or is not an object, and, with
 * `complete`, when the oracle could not read a part of it, as an index signature.
 */
export function typeMembers(
  type: AST.TSType,
  context: MembersContext,
  complete = false,
): readonly TypeMember[] | undefined {
  const shape = context.shapes({ start: type.start, end: type.end });
  const root = shape?.nodes[shape.root];
  if (!shape || root?.kind !== "object" || (complete && shape.unresolved.length)) return undefined;
  return root.members.flatMap((member) => {
    const text = memberText(member, shape, context);
    if (text === undefined) return [];
    const source = `interface T {\n${text}\n}`;
    const [statement] = parseModule("member.ts", source).program.body;
    const signature =
      statement?.type === "TSInterfaceDeclaration" && statement.body.body.length === 1
        ? statement.body.body[0]!
        : undefined;
    return signature ? [{ signature, source, shape, type: member.type }] : [];
  });
}

/** A member's signature as text: the module's own, or rebuilt from what its shape holds. */
function memberText(
  member: ShapeMember,
  shape: TypeShape,
  context: MembersContext,
): string | undefined {
  if (member.file === context.file) return context.source.slice(member.span.start, member.span.end);
  const key = `${JSON.stringify(member.name)}${member.optional ? "?" : ""}`;
  if (member.typeText) return `${key}: ${member.typeText.code}`;
  if (shape.nodes[member.type]?.kind !== "function") return `${key}: unknown`;
  try {
    return `${key}: ${printShape({ ...shape, root: member.type })}`;
  } catch {
    return undefined;
  }
}

/**
 * The type names some type's text references, each once, in source order: what a parent that
 * prints the type imports (ADR-0067), read as the oracle reads a member's.
 */
function referencesOf(code: string): string[] {
  const [statement] = parseModule("type.ts", `type T = ${code};`).program.body;
  const names: string[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!value || typeof value !== "object") return;
    const node = value as { type?: unknown; typeName?: AST.TSTypeName };
    if (node.type === "TSTypeReference" && node.typeName) {
      let name: AST.TSTypeName = node.typeName;
      while (name.type === "TSQualifiedName") name = name.left;
      if (name.type === "Identifier" && !names.includes(name.name)) names.push(name.name);
    }
    for (const [key, child] of Object.entries(value)) {
      if (key !== "type" && typeof child === "object") visit(child);
    }
  };
  if (statement?.type === "TSTypeAliasDeclaration") visit(statement.typeAnnotation);
  return names;
}

/** `references`, present only when the type references a name. */
export function withReferences(code: string): { references?: string[] } {
  const references = referencesOf(code);
  return references.length ? { references } : {};
}

/**
 * The literals a member's type resolves to, when it is a union of literals, `null` and
 * `undefined` with at least one literal, and its text as written does not spell them (UF3039).
 */
function aliasedLiterals(code: string, shape: TypeShape, type: number): { literals?: string[] } {
  const node = shape.nodes[type];
  const members = node?.kind === "union" ? node.types : [type];
  const literals: string[] = [];
  for (const id of members) {
    const each = shape.nodes[id];
    if (each?.kind === "literal") {
      literals.push(typeof each.value === "string" ? JSON.stringify(each.value) : `${each.value}`);
    } else if (each?.kind !== "primitive" || (each.name !== "null" && each.name !== "undefined")) {
      return {};
    }
  }
  return literals.length && !spellsLiterals(code) ? { literals } : {};
}

/** A member's name: an identifier's, or a string literal's. */
export function keyName(member: AST.TSSignature): string | undefined {
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

const text = (node: { start: number; end: number }, source: string) =>
  source.slice(node.start, node.end);

/** The props: the members of the first parameter's type, in member order. */
function propsOf(node: ComponentFunction, context: ApiContext): ApiMember[] {
  const [parameter] = node.params;
  const annotation =
    parameter?.type === "Identifier" || parameter?.type === "ObjectPattern"
      ? parameter.typeAnnotation?.typeAnnotation
      : undefined;
  const members = annotation ? typeMembers(annotation, context) : undefined;
  return (members ?? []).flatMap(({ signature, source, shape, type }) => {
    const name = keyName(signature);
    if (name === undefined || signature.type !== "TSPropertySignature") return [];
    const written = signature.typeAnnotation?.typeAnnotation;
    const code = written ? text(written, source) : "unknown";
    return [
      {
        name,
        optional: signature.optional,
        type: code,
        ...withReferences(code),
        ...aliasedLiterals(code, shape, type),
      },
    ];
  });
}

/** The events: each member a named tuple of its payload. */
function eventsOf(type: AST.TSType, context: ApiContext): ApiEvent[] {
  return (typeMembers(type, context) ?? []).flatMap(({ signature, source }) => {
    const name = keyName(signature);
    const tuple =
      signature.type === "TSPropertySignature" && signature.typeAnnotation?.typeAnnotation;
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
                  type: text(element.elementType, source),
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
  return (typeMembers(type, context) ?? []).flatMap(({ signature, source }) => {
    const name = keyName(signature);
    if (name === undefined) return [];
    const fn =
      signature.type === "TSMethodSignature"
        ? signature
        : signature.type === "TSPropertySignature" &&
            signature.typeAnnotation?.typeAnnotation.type === "TSFunctionType"
          ? signature.typeAnnotation.typeAnnotation
          : undefined;
    if (!fn || (signature.type !== "TSMethodSignature" && signature.type !== "TSPropertySignature"))
      return [];
    const [parameter] = fn.params;
    const props =
      parameter?.type === "Identifier" ? parameter.typeAnnotation?.typeAnnotation : undefined;
    const code = props && text(props, source);
    return [
      {
        name,
        optional: signature.optional,
        ...(code === undefined ? {} : { props: code, ...withReferences(code) }),
      },
    ];
  });
}

/**
 * A model `defineModel` declares: its name, a string literal, whether a consumer may leave it
 * unbound (anything but `required: true`), and its type argument as written. A model with
 * neither `required: true` nor a `default` can be `undefined`, so its type takes `| undefined`,
 * which a parent's binding is checked against (UF3050) and no target reads.
 */
function modelOf(call: AST.CallExpression, context: ApiContext): ApiMember | undefined {
  const [name, options] = call.arguments;
  if (name?.type !== "Literal" || typeof name.value !== "string") return undefined;
  const option = (key: string): AST.Expression | undefined => {
    if (options?.type !== "ObjectExpression") return undefined;
    for (const property of options.properties) {
      if (
        property.type === "Property" &&
        !property.computed &&
        ((property.key.type === "Identifier" && property.key.name === key) ||
          (property.key.type === "Literal" && property.key.value === key))
      ) {
        return property.value;
      }
    }
    return undefined;
  };
  const required = option("required");
  const isRequired = required?.type === "Literal" && required.value === true;
  const [type] = call.typeArguments?.params ?? [];
  if (!type) return { name: name.value, optional: !isRequired, type: "unknown" };
  const members = type.type === "TSUnionType" ? type.types : [type];
  const undefinable =
    !isRequired &&
    !option("default") &&
    !members.some(
      (member) =>
        member.type === "TSUndefinedKeyword" ||
        member.type === "TSUnknownKeyword" ||
        member.type === "TSAnyKeyword",
    );
  // A function or conditional type would take `| undefined` into its own result.
  const written =
    type.type === "TSFunctionType" ||
    type.type === "TSConstructorType" ||
    type.type === "TSConditionalType"
      ? `(${text(type, context.source)})`
      : text(type, context.source);
  return {
    name: name.value,
    optional: !isRequired,
    type: undefinable ? `${written} | undefined` : written,
    ...withReferences(written),
  };
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
