// A component's public API (ADR-0053, ADR-0055): what a parent reads of it, its props, events,
// slots, exposed functions and options, and the shape of its render root. It is read from the
// declarations alone, as written, so it is known before any component is lowered: a module's own
// components render each other, and the resolver gives a child's API without compiling the
// child or resolving the child's own children. The declarations' rules are the setup's and the
// props' to check (`./setup.ts`, `./props.ts`): a child whose API is wrong fails its own compile.

import type {
  ApiEvent,
  ApiMember,
  ApiRootDeclaration,
  ApiSlot,
  ComponentApi,
  ApiFallthroughOwn,
} from "@unframework.dev/ir";
import { isHtmlElement } from "@unframework.dev/ir";
import type { AST } from "@unframework.dev/parser";
import { isComponentName, parseModule } from "@unframework.dev/parser";
import { printShape } from "@unframework.dev/type-oracle";
import type { ShapeMember, TypeShape } from "@unframework.dev/type-oracle";

import type { AuthoringApi } from "./authoring.ts";
import { spellsLiterals } from "./cross-component.ts";
import { listenerName } from "./listeners.ts";
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
  readonly exports: ReadonlyArray<{ kind: "default" | "named" }>;
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
  // A parent reads it to reject explicit type arguments and `<component is>` (UF6006).
  const parameters = node.typeParameters?.params ?? [];
  if (parameters.length) {
    api.typeParameters = parameters.map((parameter) => parameter.name.name);
  }
  // A parent in another file wraps an async child its own way: Vue's in `<Suspense>` (ADR-0101).
  if (node.async && body.some(awaits)) {
    api.async = true;
  }
  for (const statement of body) {
    const call = macroCall(statement, context);
    if (!call) {
      continue;
    }
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
        if (inheritsNothing(call.call)) {
          api.inheritAttrs = false;
        }
        break;
      case "defineModel": {
        const model = modelOf(call.call, context);
        if (model && !api.models.some((each) => each.name === model.name)) {
          api.models.push(model);
        }
        break;
      }
      default:
        break;
    }
  }
  const root = rootOf(node, api.props, context);
  api.root = root.kind;
  if (root.tag !== undefined) {
    api.rootTag = root.tag;
  }
  // Where what a consumer passes lands (ADR-0118): the root element, or with `inheritAttrs:
  // false` the element that spreads the props' rest. A root component's is its own, which
  // `fillRootComponents` reads once every component's API is known.
  const rootOpening = rootElementOf(node)?.openingElement;
  const fallthrough = api.inheritAttrs
    ? root.tag === undefined || !rootOpening
      ? undefined
      : { tag: root.tag, svg: root.tag === "svg", opening: rootOpening }
    : restElement(node);
  if (fallthrough) {
    api.fallthroughTag = fallthrough.tag;
    if (fallthrough.svg) {
      api.fallthroughNamespace = "svg";
    }
    api.fallthroughOwn = ownOf(fallthrough.opening);
  }
  // A `<component is>` root's own attributes and listeners are its own, which a parent checks
  // what it passes with on each tag (ADR-0122).
  if (api.inheritAttrs && root.tags !== undefined && rootOpening) {
    api.fallthroughOwn = ownOf(rootOpening);
  }
  // A ref holds what the component exposes, or else its root element (ADR-0118), the one of
  // a `<component is>` root that renders (ADR-0122).
  if (!api.exposes.length && root.tag !== undefined) {
    api.refTag = root.tag;
  }
  if (!api.exposes.length && root.tags !== undefined) {
    api.refTags = root.tags;
  }
  if (root.tags !== undefined) {
    api.rootTags = root.tags;
  }
  if (root.unlisted) {
    api.rootUnlisted = true;
  }
  return api;
}

/**
 * Fills the fallthrough and ref tags of the components whose root is a component (ADR-0118):
 * each takes its root component's own, through a chain of root components in the module, and
 * from an imported one's API, which the resolver read with its own imports. With them, what a
 * parent cannot pass through such a root: the names the chain declares, and the root component
 * that exposes, which a ref cannot reach through. `rootApi` gives the API of the component a
 * root names, if it is known.
 */
export function fillRootComponents(
  apis: ReadonlyArray<{ node: ComponentFunction; api: ComponentApi }>,
  rootApi: (name: AST.JSXIdentifier) => ComponentApi | undefined,
): void {
  const roots = apis.flatMap(({ node, api }) => {
    if (api.root !== "component") {
      return [];
    }
    const name = rootElementOf(node)?.openingElement.name;
    return name?.type === "JSXIdentifier" ? [{ api, name }] : [];
  });
  // A chain in the module is as long as its components at most.
  for (let round = 0; round <= roots.length; round++) {
    let changed = false;
    for (const { api, name } of roots) {
      const child = rootApi(name);
      if (!child) {
        continue;
      }
      if (api.inheritAttrs && child.fallthroughTag !== undefined && !api.fallthroughTag) {
        api.fallthroughTag = child.fallthroughTag;
        if (child.fallthroughNamespace) {
          api.fallthroughNamespace = child.fallthroughNamespace;
        }
        if (child.fallthroughOwn) {
          api.fallthroughOwn = child.fallthroughOwn;
        }
        changed = true;
      }
      // A root component that renders a `<component is>` over tags passes on the `class` and
      // `style` a consumer gives it (ADR-0119), so it reads the tags that root may render.
      if (api.inheritAttrs && child.inheritAttrs && child.rootTags !== undefined && !api.rootTags) {
        api.rootTags = child.rootTags;
        if (child.fallthroughOwn && !api.fallthroughOwn) {
          api.fallthroughOwn = child.fallthroughOwn;
        }
        changed = true;
      }
      if (!api.exposes.length && child.refTag !== undefined && !api.refTag) {
        api.refTag = child.refTag;
        changed = true;
      }
      // A ref on it holds the element its root component's `<component is>` renders (ADR-0122).
      if (!api.exposes.length && child.refTags !== undefined && !api.refTags) {
        api.refTags = child.refTags;
        changed = true;
      }
      // What a consumer passes reaches the root component, whose declarations take it first.
      const declarations = api.inheritAttrs ? declarationsOf(child) : [];
      if (declarations.length !== (api.rootDeclarations?.length ?? 0)) {
        api.rootDeclarations = declarations;
        changed = true;
      }
      const exposing = api.exposes.length
        ? undefined
        : child.exposes.length
          ? child.name
          : child.exposingRoot;
      if (exposing !== undefined && api.exposingRoot !== exposing) {
        api.exposingRoot = exposing;
        changed = true;
      }
    }
    if (!changed) {
      break;
    }
  }
}

/**
 * What a root component declares (ADR-0118), its own names then its own root's, through which
 * the names a consumer passes to the component that renders it would fall through.
 */
function declarationsOf(child: ComponentApi): Array<ApiRootDeclaration> {
  const component = child.name;
  return [
    ...child.props.map(({ name }) => ({ name, kind: "prop" as const, component })),
    ...child.models.map(({ name }) => ({ name, kind: "model" as const, component })),
    ...child.events.map(({ name }) => ({ name, kind: "event" as const, component })),
    ...(child.rootDeclarations ?? []),
  ];
}

/** The JSX element a component returns, without parentheses. */
function rootElementOf(node: ComponentFunction): AST.JSXElement | undefined {
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
  while (returned?.type === "ParenthesizedExpression") {
    returned = returned.expression;
  }
  return returned?.type === "JSXElement" ? returned : undefined;
}

/**
 * The element that spreads the props' rest, `<input {...rest} />` (ADR-0118): the first in
 * source order, as the setup's checks allow one only, with whether it is an SVG element, inside
 * an `<svg>` as the analyser places it. `<component is>` is none: its rest is UF2001.
 */
/**
 * The fallthrough element's own attributes and listeners, as its source writes them (ADR-0118),
 * which a parent checks a listener it passes with (UF3030). A spread's keys are left out.
 */
function ownOf(opening: AST.JSXOpeningElement): ApiFallthroughOwn {
  const own: ApiFallthroughOwn = { attributes: [], listeners: [] };
  for (const item of opening.attributes) {
    if (item.type !== "JSXAttribute" || item.name.type !== "JSXIdentifier") {
      continue;
    }
    const written = item.name.name;
    const listener = /^on/i.test(written) ? listenerName(written) : undefined;
    if (listener) {
      if (!own.listeners.includes(listener.event)) {
        own.listeners.push(listener.event);
      }
      continue;
    }
    if (written === "key" || written === "ref" || written === "is") {
      continue;
    }
    const { value } = item;
    // A bound attribute has no value here: the check reads it as present, value unknown.
    const known =
      value === null
        ? true
        : value.type === "Literal" && typeof value.value === "string"
          ? value.value
          : undefined;
    own.attributes.push({
      name: written.toLowerCase(),
      ...(known === undefined ? {} : { value: known }),
    });
  }
  return own;
}

function restElement(
  node: ComponentFunction,
): { tag: string; svg: boolean; opening: AST.JSXOpeningElement } | undefined {
  const [parameter] = node.params;
  const pattern = parameter?.type === "ObjectPattern" ? parameter : undefined;
  const rest = pattern?.properties.find((property) => property.type === "RestElement");
  if (rest?.type !== "RestElement" || rest.argument.type !== "Identifier") {
    return undefined;
  }
  const name = rest.argument.name;
  const statements = node.body?.type === "BlockStatement" ? node.body.body : [];
  const last = statements.at(-1);
  const returned = node.body?.type === "BlockStatement" ? last : node.body;
  let found: { tag: string; svg: boolean; opening: AST.JSXOpeningElement } | undefined;
  const visit = (value: unknown, svg: boolean): void => {
    if (found !== undefined || !value || typeof value !== "object") {
      return;
    }
    if (Array.isArray(value)) {
      for (const each of value) {
        visit(each, svg);
      }
      return;
    }
    const each = value as { type?: unknown };
    let inside = svg;
    if (each.type === "JSXElement") {
      const tag = (value as AST.JSXElement).openingElement.name;
      if (tag.type === "JSXIdentifier" && tag.name === "svg") {
        inside = true;
      }
    }
    if (each.type === "JSXOpeningElement") {
      const opening = value as AST.JSXOpeningElement;
      if (
        opening.name.type === "JSXIdentifier" &&
        !isComponentName(opening.name.name) &&
        opening.attributes.some(
          (item) =>
            item.type === "JSXSpreadAttribute" &&
            item.argument.type === "Identifier" &&
            item.argument.name === name,
        )
      ) {
        if (opening.name.name !== "component") {
          found = { tag: opening.name.name, svg, opening };
        }
        return;
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (key !== "parent") {
        visit(child, inside);
      }
    }
  };
  visit(returned, false);
  return found;
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
  if (resolution.kind !== "import") {
    return undefined;
  }
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
 * from the files it imports. `undefined` when the type has no shape or is not an object.
 */
export function typeMembers(
  type: AST.TSType,
  context: MembersContext,
): ReadonlyArray<TypeMember> | undefined {
  const shape = context.shapes({ start: type.start, end: type.end });
  const root = shape?.nodes[shape.root];
  if (!shape || root?.kind !== "object") {
    return undefined;
  }
  return root.members.flatMap((member) => {
    const text = memberText(member, shape, context);
    if (text === undefined) {
      return [];
    }
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
  if (member.file === context.file) {
    return context.source.slice(member.span.start, member.span.end);
  }
  const key = `${JSON.stringify(member.name)}${member.optional ? "?" : ""}`;
  if (member.typeText) {
    return `${key}: ${member.typeText.code}`;
  }
  if (shape.nodes[member.type]?.kind !== "function") {
    return `${key}: unknown`;
  }
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
function referencesOf(type: string | AST.TSType): Array<string> {
  let root = typeof type === "string" ? undefined : type;
  if (typeof type === "string") {
    const [statement] = parseModule("type.ts", `type T = ${type};`).program.body;
    if (statement?.type === "TSTypeAliasDeclaration") {
      root = statement.typeAnnotation;
    }
  }
  const names: Array<string> = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }
    if (!value || typeof value !== "object") {
      return;
    }
    const node = value as { type?: unknown; typeName?: AST.TSTypeName };
    if (node.type === "TSTypeReference" && node.typeName) {
      let name: AST.TSTypeName = node.typeName;
      while (name.type === "TSQualifiedName") {
        name = name.left;
      }
      if (name.type === "Identifier" && !names.includes(name.name)) {
        names.push(name.name);
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (key !== "type" && typeof child === "object") {
        visit(child);
      }
    }
  };
  if (root) {
    visit(root);
  }
  return names;
}

/**
 * `references`, present only when the type references a name. A type already parsed is read as
 * it is: a component's every prop would otherwise parse its type again.
 */
export function withReferences(type: string | AST.TSType): { references?: Array<string> } {
  const references = referencesOf(type);
  return references.length ? { references } : {};
}

/**
 * The literals a member's type resolves to, when it is a union of literals, `null` and
 * `undefined` with at least one literal, and its text as written does not spell them (UF3039).
 */
function aliasedLiterals(
  code: string,
  shape: TypeShape,
  type: number,
): { literals?: Array<string> } {
  const node = shape.nodes[type];
  const members = node?.kind === "union" ? node.types : [type];
  const literals: Array<string> = [];
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
  if (key.type === "Identifier") {
    return key.name;
  }
  return key.type === "Literal" && typeof key.value === "string" ? key.value : undefined;
}

const text = (node: { start: number; end: number }, source: string) =>
  source.slice(node.start, node.end);

/** The props: the members of the first parameter's type, in member order. */
function propsOf(node: ComponentFunction, context: ApiContext): Array<ApiMember> {
  const [parameter] = node.params;
  const annotation =
    parameter?.type === "Identifier" || parameter?.type === "ObjectPattern"
      ? parameter.typeAnnotation?.typeAnnotation
      : undefined;
  const members = annotation ? typeMembers(annotation, context) : undefined;
  return (members ?? []).flatMap(({ signature, source, shape, type }) => {
    const name = keyName(signature);
    if (name === undefined || signature.type !== "TSPropertySignature") {
      return [];
    }
    const written = signature.typeAnnotation?.typeAnnotation;
    const code = written ? text(written, source) : "unknown";
    return [
      {
        name,
        optional: signature.optional,
        type: code,
        ...(written ? withReferences(written) : {}),
        ...aliasedLiterals(code, shape, type),
      },
    ];
  });
}

/** The events: each member a named tuple of its payload. */
function eventsOf(type: AST.TSType, context: ApiContext): Array<ApiEvent> {
  return (typeMembers(type, context) ?? []).flatMap(({ signature, source }) => {
    const name = keyName(signature);
    const tuple =
      signature.type === "TSPropertySignature" && signature.typeAnnotation?.typeAnnotation;
    if (name === undefined || !tuple || tuple.type !== "TSTupleType") {
      return [];
    }
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
function slotsOf(type: AST.TSType, context: ApiContext): Array<ApiSlot> {
  return (typeMembers(type, context) ?? []).flatMap(({ signature, source }) => {
    const name = keyName(signature);
    if (name === undefined) {
      return [];
    }
    const fn =
      signature.type === "TSMethodSignature"
        ? signature
        : signature.type === "TSPropertySignature" &&
            signature.typeAnnotation?.typeAnnotation.type === "TSFunctionType"
          ? signature.typeAnnotation.typeAnnotation
          : undefined;
    if (
      !fn ||
      (signature.type !== "TSMethodSignature" && signature.type !== "TSPropertySignature")
    ) {
      return [];
    }
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
  if (name?.type !== "Literal" || typeof name.value !== "string") {
    return undefined;
  }
  const option = (key: string): AST.Expression | undefined => {
    if (options?.type !== "ObjectExpression") {
      return undefined;
    }
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
  if (!type) {
    return { name: name.value, optional: !isRequired, type: "unknown" };
  }
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
function exposedOf(call: AST.CallExpression): Array<string> {
  const [object] = call.arguments;
  if (object?.type !== "ObjectExpression") {
    return [];
  }
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

/**
 * What a component's returned JSX is: one element (with its tag), one component, one
 * `<component is>` over tags (with the tags, ADR-0119), or other, as a `<Teleport>` or a
 * `<Transition>` is (ADR-0098, ADR-0100).
 */
function rootOf(
  node: ComponentFunction,
  props: ReadonlyArray<ApiMember>,
  context: ApiContext,
): {
  kind: ComponentApi["root"];
  tag?: string;
  tags?: Array<string>;
  unlisted?: true;
} {
  const returned = rootElementOf(node);
  if (!returned) {
    return { kind: "other" };
  }
  const name = returned.openingElement.name;
  if (name.type !== "JSXIdentifier") {
    return { kind: "other" };
  }
  const resolution = context.scopes.resolve(name as unknown as AST.IdentifierReference);
  if (
    resolution.kind === "import" &&
    (context.authoring.get(resolution.declaration) === "Teleport" ||
      context.authoring.get(resolution.declaration) === "Transition")
  ) {
    return { kind: "other" };
  }
  if (isComponentName(name.name)) {
    return { kind: "component" };
  }
  if (name.name === "component") {
    return dynamicRoot(returned.openingElement, node, props, context);
  }
  return { kind: "element", tag: name.name };
}

/**
 * A `<component is>` root (ADR-0119): `dynamic`, with its tags, where `is` lists them without
 * any render context, as a literal, a conditional of literals or a prop typed as a union of
 * string literals. The lowering reads the same forms (`./dynamic.ts`), so the two agree. Other
 * where `is` names a component, and `unlisted` where it reads a value the API cannot list.
 */
function dynamicRoot(
  opening: AST.JSXOpeningElement,
  node: ComponentFunction,
  props: ReadonlyArray<ApiMember>,
  context: ApiContext,
): { kind: ComponentApi["root"]; tags?: Array<string>; unlisted?: true } {
  const is = opening.attributes.find(
    (item): item is AST.JSXAttribute =>
      item.type === "JSXAttribute" && item.name.type === "JSXIdentifier" && item.name.name === "is",
  )?.value;
  const expression =
    is?.type === "Literal"
      ? is
      : is?.type === "JSXExpressionContainer" && is.expression.type !== "JSXEmptyExpression"
        ? is.expression
        : undefined;
  if (!expression) {
    return { kind: "other" };
  }
  const leaves = tagsOf(expression, node, props, context);
  if (leaves === "component") {
    return { kind: "other" };
  }
  if (!leaves?.length || !leaves.every((leaf) => isHtmlElement(leaf))) {
    return { kind: "other", unlisted: true };
  }
  return { kind: "dynamic", tags: [...new Set(leaves)] };
}

/**
 * The tags an `is` lists in a form the API reads, in source order: `"component"` where a leaf
 * names a component, and undefined where a leaf is a value it cannot list.
 */
function tagsOf(
  node: AST.Expression | AST.StringLiteral,
  component: ComponentFunction,
  props: ReadonlyArray<ApiMember>,
  context: ApiContext,
): Array<string> | "component" | undefined {
  switch (node.type) {
    case "ParenthesizedExpression":
      return tagsOf(node.expression, component, props, context);
    case "Literal":
      return typeof node.value === "string" ? [node.value] : undefined;
    case "TemplateLiteral":
      return node.expressions.length ? undefined : [node.quasis[0]!.value.cooked ?? ""];
    case "ConditionalExpression": {
      const consequent = tagsOf(node.consequent, component, props, context);
      const alternate = tagsOf(node.alternate, component, props, context);
      if (consequent === "component" || alternate === "component") {
        return "component";
      }
      return consequent && alternate ? [...consequent, ...alternate] : undefined;
    }
    case "Identifier": {
      // A prop first: `{ Tag }: { Tag: "a" | "button" }` names tags, though it is capitalised.
      const name = propNamed(node, component, context);
      const prop = name === undefined ? undefined : props.find((each) => each.name === name);
      if (prop) {
        return stringLiterals(prop);
      }
      return isComponentName(node.name) ? "component" : undefined;
    }
    case "MemberExpression": {
      // The object form's `props.tag`.
      const [parameter] = component.params;
      if (
        node.computed ||
        node.property.type !== "Identifier" ||
        node.object.type !== "Identifier" ||
        parameter?.type !== "Identifier" ||
        node.object.name !== parameter.name
      ) {
        return undefined;
      }
      const resolution = context.scopes.resolve(node.object);
      if (resolution.kind !== "parameter" || resolution.function !== component) {
        return undefined;
      }
      const property = node.property.name;
      const prop = props.find((each) => each.name === property);
      return prop ? stringLiterals(prop) : undefined;
    }
    default:
      return undefined;
  }
}

/** The prop a destructured parameter binds, by the identifier that reads it. */
function propNamed(
  node: AST.IdentifierReference,
  component: ComponentFunction,
  context: ApiContext,
): string | undefined {
  const resolution = context.scopes.resolve(node);
  if (resolution.kind !== "parameter" || resolution.function !== component) {
    return undefined;
  }
  const [parameter] = component.params;
  if (parameter?.type !== "ObjectPattern") {
    return undefined;
  }
  for (const property of parameter.properties) {
    if (property.type !== "Property" || property.computed) {
      continue;
    }
    const value =
      property.value.type === "AssignmentPattern" ? property.value.left : property.value;
    if (value !== resolution.declaration) {
      continue;
    }
    return property.key.type === "Identifier"
      ? property.key.name
      : property.key.type === "Literal"
        ? String(property.key.value)
        : undefined;
  }
  return undefined;
}

/** The strings a prop's type is a union of, as written or through an alias, or undefined. */
function stringLiterals(prop: ApiMember): Array<string> | undefined {
  const members = prop.literals ?? prop.type.split("|").map((member) => member.trim());
  const strings: Array<string> = [];
  for (const member of members) {
    const literal = /^"([^"\\]*)"$/.exec(member) ?? /^'([^'\\]*)'$/.exec(member);
    if (!literal) {
      return undefined;
    }
    strings.push(literal[1]!);
  }
  return strings.length ? strings : undefined;
}

/** Whether a setup statement is an awaited declaration, `const user = await …` (ADR-0101). */
function awaits(statement: AST.Directive | AST.Statement): boolean {
  return (
    statement.type === "VariableDeclaration" &&
    statement.kind === "const" &&
    statement.declarations.some((declarator) => declarator.init?.type === "AwaitExpression")
  );
}
