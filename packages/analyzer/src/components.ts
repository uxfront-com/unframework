// Composition in templates (ADR-0053, ADR-0054): a component element, `<Field label="Name"
// onClear={reset} />`, with its props, listeners, fallthrough `class` and `style`, ref and slot
// fills; and a component's own slots, rendered (`{slots.title?.()}`, with fallback after `??`)
// and forwarded (`{{ title: slots.title }}`). A component element names an imported component,
// one of the module's own, or the component itself, by the API read from its declarations
// (`./api.ts`); what that API does not declare is reported (layer 2 of §5.6), with the name it
// may mean and its rename (`./cross-component.ts`).

import {
  createBinding,
  createClassAttribute,
  createComponentNode,
  createExpression,
  createListenerAttribute,
  createParameter,
  createParameterPattern,
  createPropAttribute,
  createSlotFill,
  createSlotOutlet,
  createStaticClass,
  DOM_EVENTS,
} from "@unframework.dev/ir";
import type {
  ComponentApi,
  ComponentAttribute,
  ComponentNode,
  Handler,
  Namespace,
  Parameter,
  SlotFill,
  SlotOutletNode,
  Span,
} from "@unframework.dev/ir";
import type { AST } from "@unframework.dev/parser";

import { keyName } from "./api.ts";
import { attributesOf, canonicalName, isAttributeOf } from "./attribute-names.ts";
import { keyCase, lowerAttributes, misplacedKey } from "./attributes.ts";
import { closest, literalOutsideUnion, renameFix } from "./cross-component.ts";
import { directiveOnNonElement, isDirectiveAttribute } from "./directives.ts";
import { ELEMENT_INTERFACES } from "./element-interfaces.ts";
import { checkPlacement } from "./elements.ts";
import { checkExpression, shadowing, span } from "./expressions.ts";
import { isElementEvent, listenerName, lowerComponentHandler, lowerRef } from "./listeners.ts";
import { hasContent, lowerChildren, lowerContent, textPlacementProblem } from "./lower.ts";
import type { Place } from "./lower.ts";
import { CONTROL_MODEL, lowerModelBinding, namelessModel } from "./models.ts";
import type { ComponentInfo, LoopVariable, RenderContext } from "./render.ts";
import { setupBindingOf } from "./render.ts";
import type { TypeTable } from "./types/from-type.ts";
import { UNKNOWN } from "./types/kinds.ts";

/** A component element, lowered, and the `key` a list lifts off it. */
export interface LoweredComponent {
  node: ComponentNode | undefined;
  key: AST.JSXAttribute | undefined;
}

/** A listener's option suffixes, which an event a component declares takes none of (UF3043). */
const OPTION_SUFFIXES = ["Capture", "Once", "Passive"] as const;

/**
 * Lowers a component element (ADR-0053): the component it names, its attributes and its fills.
 * `listBody` marks the element a list's `.map` renders, whose `key` the list lifts.
 */
export function lowerComponent(
  node: AST.JSXElement,
  name: AST.JSXIdentifier,
  place: Place,
  render: RenderContext,
  listBody: boolean,
): LoweredComponent {
  const info = componentOf(name, render);
  if (!info) {
    // A name an unresolved import binds is reported where it is imported (UF1202).
    if (info === undefined) unknownComponent(node, name, render);
    // Its content is still checked, as an element's is once its tag is reported.
    lowerChildren(node.children, FILL, render);
    return { node: undefined, key: undefined };
  }
  return lowerComponentAs(node, name, info, place, render, listBody);
}

/**
 * Lowers a component element as the component `info` names: its attributes and its fills, as
 * that component declares them. `<component is>` lowers its attributes and fills so for each
 * of its component candidates (`./dynamic.ts`), leaving out `skip`, its `is`.
 */
export function lowerComponentAs(
  node: AST.JSXElement,
  name: AST.JSXIdentifier,
  info: ComponentInfo,
  place: Place,
  render: RenderContext,
  listBody: boolean,
  skip?: AST.JSXAttribute,
): LoweredComponent {
  const { reporter } = render;
  const mark = reporter.diagnostics.length;
  const { api } = info;
  // Its root element is checked where the component sits, as the element would be there
  // (ADR-0054): a root that lives only inside a given parent (`<li>`, `<tr>`) is checked against
  // the element around the component, which only the parent's compile knows. With no element
  // around it (a slot's fill, this component's own root), nothing places such a root.
  // A `<component is>` root may render any of its tags, so each is placed (ADR-0119).
  for (const tag of api.rootTag !== undefined
    ? [api.rootTag]
    : api.root === "dynamic"
      ? (api.rootTags ?? [])
      : []) {
    checkPlacement(tag, name, place.ancestors, reporter, false);
  }
  const attributes: ComponentAttribute[] = [];
  const fallthrough: AST.JSXAttribute[] = [];
  let key: AST.JSXAttribute | undefined;
  let after = name.end;
  /** Each name set so far: a component takes each once, as an element does (UF3007). */
  const seen = new Map<string, AST.JSXAttribute>();
  // What a rename may not write over (`renameFix`): none is offered on `<component is>`.
  const items = skip ? undefined : node.openingElement.attributes;
  for (const item of node.openingElement.attributes) {
    const previous = after;
    after = item.end;
    if (item === skip) continue;
    if (item.type === "JSXAttribute") {
      const written =
        item.name.type === "JSXIdentifier"
          ? item.name.name
          : `${item.name.namespace.name}:${item.name.name.name}`;
      const first = seen.get(written);
      if (first) {
        reporter.report(
          "UF3007",
          item.name,
          `\`${written}\` is set twice on this <${info.name}>.`,
          {
            help: "Keep one: the targets disagree about which value wins.",
            related: [{ span: span(first.name), message: "First set here" }],
          },
        );
        continue;
      }
      seen.set(written, item);
    }
    if (item.type === "JSXSpreadAttribute") {
      if (isRestSpread(item, render)) {
        reporter.report(
          "UF2001",
          item,
          `\`${render.restProps!.name}\` is spread on <${info.name}>, a component: the props' rest is spread on one element (ADR-0118).`,
          { help: `Spread it on an element, \`<input {...${render.restProps!.name}} />\`.` },
        );
        continue;
      }
      reporter.unsupported(
        item,
        "A spread on a component is not supported: a component takes each prop by its name.",
        { help: "Pass each prop as an attribute of its own: `label={field.label}`." },
      );
      continue;
    }
    if (item.name.type === "JSXNamespacedName") {
      const binding = lowerModelBinding(item, item.name, api, info, render, items);
      if (binding) attributes.push(binding);
      continue;
    }
    const attribute = item.name.name;
    if (attribute === "key" || attribute.toLowerCase() === "key") {
      if (!listBody) misplacedKey(item, previous, reporter);
      else {
        if (attribute !== "key") keyCase(item, item.name, reporter);
        key = item;
      }
      continue;
    }
    if (attribute === "ref") {
      const ref = lowerRef(item, item.name, { tag: info.name, render }, render.attached);
      if (!ref || ref.kind !== "Ref") continue;
      if (componentRefProblem(item, ref.binding, api, info, render)) continue;
      attributes.push(ref);
      continue;
    }
    if (attribute === "class" || attribute === "style") {
      fallthrough.push(item);
      continue;
    }
    if (CONTROL_MODEL.test(attribute)) {
      namelessModel(item.name, api, info, render);
      continue;
    }
    if (isDirectiveAttribute(attribute)) {
      directiveOnNonElement(
        item.name,
        skip ? "`<component is>`" : `<${info.name}>, a component`,
        reporter,
      );
      continue;
    }
    if (/^on[A-Z]/.test(attribute)) {
      if (passesListener(attribute, api)) {
        if (!reachesRootDeclaration(item, item.name, api, info, render)) fallthrough.push(item);
        continue;
      }
      const listener = lowerComponentListener(item, item.name, api, info, render, items);
      if (listener) attributes.push(listener);
      continue;
    }
    if (kebabMember(item, item.name, api, info, render, items)) continue;
    if (passesAttribute(attribute, api)) {
      if (!reachesRootDeclaration(item, item.name, api, info, render)) fallthrough.push(item);
      continue;
    }
    const prop = lowerProp(item, item.name, api, info, render, items);
    if (prop) attributes.push(prop);
  }
  // `<component is>` passes its candidates `class` and `style` (ADR-0054), and no target passes
  // them anything else that falls through yet (ADR-0118).
  const passed = skip
    ? fallthrough.filter((item) => {
        const written = item.name.type === "JSXIdentifier" ? item.name.name : "";
        if (written === "class" || written === "style") return true;
        reporter.unsupported(
          item.name,
          "What falls through to a candidate of `<component is>` is not supported yet: `class` and `style` do, and a candidate takes its own props and events.",
          { help: "Pass what every candidate declares, or render each by its own tag." },
        );
        return false;
      })
    : fallthrough;
  attributes.push(...lowerFallthrough(passed, node.openingElement, api, info, render));
  // In source order, as written: what falls through is lowered apart, and the first construct a
  // target lacks is reported where the source first writes it (UF4001).
  attributes.sort((a, b) => a.span.start - b.span.start);
  const fills = lowerFills(node, api, info, render, items !== undefined);
  if (!fills || reporter.hasErrorsSince(mark)) return { node: undefined, key };
  return { node: createComponentNode(info.name, attributes, fills, span(node)), key };
}

/**
 * Whether a ref on a component is reported (UF3046, ADR-0054): the component exposes nothing, or
 * the template ref's type is not an object type of what it exposes (`useTemplateRef<{ focus():
 * void }>()`), so a call through it could reach a member the component does not have.
 */
function componentRefProblem(
  item: AST.JSXAttribute,
  binding: string,
  api: ComponentApi,
  info: ComponentInfo,
  render: RenderContext,
): boolean {
  const report = (message: string, help: string) => {
    render.reporter.report("UF3046", item, message, { help });
    return true;
  };
  if (!api.exposes.length) {
    // A ref on a component that exposes nothing holds its root element (ADR-0118), typed as
    // that element's DOM interface.
    const element = api.refTag === undefined ? undefined : ELEMENT_INTERFACES.get(api.refTag);
    if (element === undefined && api.exposingRoot !== undefined) {
      // Vue's ref would hold the root element, the other targets' the root component's exposed
      // functions, which this component does not expose (ADR-0118).
      return report(
        `\`${info.name}\`'s root, \`${api.exposingRoot}\`, exposes functions, which \`${info.name}\` does not expose: a ref on \`${info.name}\` would hold those functions on most targets and its root element on Vue.`,
        `Expose from ${info.name} with \`defineExpose({ … })\`, or give it an element root.`,
      );
    }
    if (element === undefined) {
      return report(
        `\`${info.name}\` exposes nothing and its root is not one element, so a ref on it holds nothing.`,
        `Expose the functions a parent calls from ${info.name} with \`defineExpose({ … })\`, give it one root element, or remove the ref.`,
      );
    }
    const type = templateRefType(binding, render);
    const written =
      type?.type === "TSTypeReference" && type.typeName.type === "Identifier" && !type.typeArguments
        ? type.typeName.name
        : undefined;
    if (written !== element) {
      return report(
        `A ref on \`${info.name}\` holds its root <${api.refTag}>, an \`${element}\`, and this template ref is ${type ? "typed as another type" : "not typed"}.`,
        `Type it as the root element: \`useTemplateRef<${element}>()\`.`,
      );
    }
    return false;
  }
  const exposed = api.exposes.map((name) => `\`${name}\``).join(", ");
  const type = templateRefType(binding, render);
  const members = type ? refMembers(type, render.types) : undefined;
  if (!members) {
    return report(
      `The template ref on \`${info.name}\` is not typed as an object type of what it exposes (${exposed}): a call through it could name anything.`,
      `Type it with what ${info.name} exposes: \`useTemplateRef<{ ${api.exposes[0]}(): void }>()\`.`,
    );
  }
  for (const member of members) {
    const name = keyName(member);
    if (name !== undefined && api.exposes.includes(name)) continue;
    return report(
      `The template ref's type names ${name === undefined ? "a member" : `\`${name}\``}, which \`${info.name}\` does not expose: it exposes ${exposed}.`,
      `Type the ref with what ${info.name} exposes, or expose ${name === undefined ? "the member" : `\`${name}\``} from it.`,
    );
  }
  return false;
}

/**
 * The members of a template ref's type, as written in the module: a type literal's, or a local
 * `interface`'s or `type`'s of one. Read from the syntax, not the type oracle's shapes: UF3046
 * needs only the member names, and a shape cannot say which unread parts hide a member.
 */
function refMembers(type: AST.TSType, table: TypeTable): readonly AST.TSSignature[] | undefined {
  if (type.type === "TSTypeLiteral") return type.members;
  if (type.type !== "TSTypeReference" || type.typeName.type !== "Identifier" || type.typeArguments)
    return undefined;
  const declaration = table.declaration(type.typeName.name);
  if (!declaration) return undefined;
  const { node } = declaration;
  if (node.type === "TSInterfaceDeclaration") return node.body.body;
  return node.typeAnnotation.type === "TSTypeLiteral" ? node.typeAnnotation.members : undefined;
}

/** The type argument of the `useTemplateRef` call that declares a template ref, if it has one. */
function templateRefType(binding: string, render: RenderContext): AST.TSType | undefined {
  const declaration = [...render.setup.bindings.values()].find(
    (each) => each.id === binding,
  )?.declaration;
  const body = render.component.body;
  if (!declaration || body?.type !== "BlockStatement") return undefined;
  for (const statement of body.body) {
    if (statement.type !== "VariableDeclaration") continue;
    for (const declarator of statement.declarations) {
      if (declarator.id !== declaration || declarator.init?.type !== "CallExpression") continue;
      return declarator.init.typeArguments?.params[0];
    }
  }
  return undefined;
}

/**
 * The component a tag names: an imported one, or a component function of the module; `null` for
 * a name an unresolved import binds, and `undefined` for none.
 */
export function componentOf(
  name: AST.JSXIdentifier | AST.IdentifierReference,
  render: RenderContext,
): ComponentInfo | null | undefined {
  const resolution = render.scopes.resolve(name as unknown as AST.IdentifierReference);
  if (resolution.kind !== "import" && resolution.kind !== "variable") return undefined;
  if (!render.components.has(resolution.declaration)) return undefined;
  return render.components.get(resolution.declaration) ?? null;
}

/** A tag that names no component in scope (UF3047), with the name it may mean. */
function unknownComponent(
  node: AST.JSXElement,
  name: AST.JSXIdentifier,
  render: RenderContext,
): void {
  const closing = node.closingElement?.name;
  const known = [
    ...new Set([...render.components.values()].flatMap((each) => (each ? [each.name] : []))),
  ];
  const meant = closest(name.name, known);
  render.reporter.report(
    "UF3047",
    name,
    `<${name.name}> names no component in scope: a PascalCase tag is an imported component, or a component of this module.${meant ? ` Did you mean \`${meant}\`?` : ""}`,
    {
      help: `Import it, as in \`import ${name.name} from "./${name.name}.uf.tsx";\`, or declare it in this module.`,
      ...(meant
        ? {
            fixes: [
              {
                title: `Write \`${meant}\``,
                confidence: "likely",
                edits: [
                  { span: span(name), text: meant },
                  ...(closing ? [{ span: span(closing), text: meant }] : []),
                ],
              },
            ],
          }
        : {}),
    },
  );
}

/**
 * A prop (ADR-0053): a name the component declares, with a static string or an expression. Any
 * other name is UF3035, and a literal outside the prop's union of literals UF3039. `items` are
 * the element's attributes, for the renames (`renameFix`).
 */
function lowerProp(
  item: AST.JSXAttribute,
  name: AST.JSXIdentifier,
  api: ComponentApi,
  info: ComponentInfo,
  render: RenderContext,
  items: readonly AST.JSXAttributeItem[] | undefined,
): ComponentAttribute | undefined {
  const { reporter, source } = render;
  const prop = api.props.find((each) => each.name === name.name);
  if (!prop && api.slots.some((each) => each.name === name.name)) {
    reporter.report(
      "UF3035",
      name,
      `\`${name.name}\` is a slot of ${info.name}, not a prop or an attribute: a slot is filled with content.`,
      {
        help: `Fill it in a slot object: \`<${info.name}>{{ ${name.name}: () => <b>…</b> }}</${info.name}>\`.`,
      },
    );
    return undefined;
  }
  if (!prop) {
    const tag = api.fallthroughTag;
    // What it may mean: a prop, or an attribute of the element what it does not declare lands
    // on, an ARIA one only for an `aria` name: `aria-` alone is within reach of a long one.
    const aria = /^aria/i.test(name.name);
    // Never a name that would be rejected too: a slot, the kebab form of a prop or a model, or
    // a name the root component declares.
    const rejected = new Set([
      ...api.slots.map((each) => each.name),
      ...(api.rootDeclarations ?? []).map((each) => each.name),
    ]);
    const declared = new Set([...api.props, ...api.models].map((each) => each.name));
    const meant = closest(name.name, [
      ...api.props.map((each) => each.name),
      ...(tag === undefined
        ? []
        : attributesOf(tag, namespaceOf(api)).filter(
            (attribute) =>
              (aria || !attribute.startsWith("aria-")) &&
              !rejected.has(attribute) &&
              !rejected.has(camelize(attribute)) &&
              !declared.has(camelize(attribute)),
          )),
    ]);
    const others = items?.flatMap((each) =>
      each !== item && each.type === "JSXAttribute" && each.name.type === "JSXIdentifier"
        ? [each.name.name]
        : [],
    );
    reporter.report(
      "UF3035",
      name,
      `${info.name} declares no prop \`${name.name}\`, and it is no attribute of ${tag === undefined ? "an element" : `<${tag}>`}, where what ${info.name} does not declare lands: a component takes its props, \`key\`, \`ref\`, its events' listeners, its slots and, falling through, \`class\`, \`style\`, attributes and DOM listeners.${meant ? ` Did you mean \`${meant}\`?` : ""}`,
      {
        help:
          tag === undefined
            ? `Pass a prop ${info.name} declares, or declare \`${name.name}\` in its props.`
            : `Pass a prop ${info.name} declares or an attribute of <${tag}>, or declare \`${name.name}\` in its props.`,
        ...(meant ? { fixes: renameFix(meant, meant, name, others) } : {}),
      },
    );
    return undefined;
  }
  const { value } = item;
  if (!value) {
    reporter.unsupported(
      item,
      `\`${name.name}\` is written without a value: a prop's value is written out.`,
      { help: `Write \`${name.name}={true}\`.` },
    );
    return undefined;
  }
  if (value.type === "Literal") {
    const raw = source.slice(value.start, value.end);
    // A JSX string is read as written, where a JavaScript one reads escapes: one without them
    // reads alike in both, and is the prop's value as an expression.
    if (/[\\&\r\n]/.test(raw)) {
      reporter.unsupported(
        value,
        "A static prop holding `\\`, `&` or a line break is not supported: JSX reads it as written, and the targets' templates would read its escapes.",
        { help: `Write it as an expression: \`${name.name}={${JSON.stringify(value.value)}}\`.` },
      );
      return undefined;
    }
    if (literalOutsideUnion(value, false, prop, info.name, reporter, items !== undefined)) {
      return undefined;
    }
    return createPropAttribute(name.name, createExpression(raw, span(value)), span(item));
  }
  if (value.type !== "JSXExpressionContainer" || value.expression.type === "JSXEmptyExpression") {
    reporter.unsupported(value, "A prop's value is a string or an expression in braces.");
    return undefined;
  }
  const checked = checkExpression(value.expression, render);
  if (!checked.clean) return undefined;
  const { expression } = value;
  if (
    expression.type === "Literal" &&
    literalOutsideUnion(expression, true, prop, info.name, reporter, items !== undefined)
  ) {
    return undefined;
  }
  return createPropAttribute(name.name, checked.expression, span(item));
}

/**
 * A listener of an event the component declares (ADR-0053): `onClear` for `clear`. A listener's
 * option suffix is UF3043, an event it does not declare UF3036. `items` are the element's
 * attributes, for the renames (`renameFix`).
 */
function lowerComponentListener(
  item: AST.JSXAttribute,
  name: AST.JSXIdentifier,
  api: ComponentApi,
  info: ComponentInfo,
  render: RenderContext,
  items: readonly AST.JSXAttributeItem[] | undefined,
): ComponentAttribute | undefined {
  const { reporter } = render;
  const event = eventName(name.name);
  const declared = api.events.some((each) => each.name === event);
  if (!declared) {
    const suffix = OPTION_SUFFIXES.find((each) => name.name.endsWith(each));
    const base = suffix ? eventName(name.name.slice(0, -suffix.length)) : undefined;
    if (suffix && base !== undefined && api.events.some((each) => each.name === base)) {
      const at = { start: name.end - suffix.length, end: name.end };
      reporter.report(
        "UF3043",
        at,
        `\`${name.name}\` listens to ${info.name}'s \`${base}\` with the option \`${suffix}\`: a component's event is no DOM event, and takes no listener option.`,
        {
          help: `Write \`${name.name.slice(0, -suffix.length)}\`.`,
          fixes: [
            { title: `Remove \`${suffix}\``, confidence: "safe", edits: [{ span: at, text: "" }] },
          ],
        },
      );
      return undefined;
    }
    // What it may mean: an event the component declares, or a DOM event that falls through.
    // Never a DOM event a root component declares as its own, which would be rejected too.
    const rootEvents = new Set(
      (api.rootDeclarations ?? []).flatMap((each) => (each.kind === "event" ? [each.name] : [])),
    );
    const meant = closest(event, [
      ...api.events.map((each) => each.name),
      ...(takesFallthrough(api)
        ? [...DOM_EVENTS.keys()].filter((each) => !rootEvents.has(each))
        : []),
    ]);
    const listener = meant && `on${meant.charAt(0).toUpperCase()}${meant.slice(1)}`;
    // The events the element's other listeners name, as UF3043's fix leaves them.
    const others = items?.flatMap((each) => {
      if (each === item || each.type !== "JSXAttribute" || each.name.type !== "JSXIdentifier") {
        return [];
      }
      const written = each.name.name;
      if (!/^on[A-Z]/.test(written)) return [];
      const option = OPTION_SUFFIXES.find((ending) => written.endsWith(ending));
      return [eventName(option ? written.slice(0, -option.length) : written)];
    });
    reporter.report(
      "UF3036",
      name,
      `${info.name} declares no event \`${event}\`, and \`${event}\` is no DOM event: \`${name.name}\` listens to an event the component emits, or to a DOM event that falls through to its root.${listener ? ` Did you mean \`${listener}\`?` : ""}`,
      {
        help: `Listen to an event ${info.name} declares with \`defineEmits\`, or listen on an element inside it.`,
        ...(meant && listener ? { fixes: renameFix(meant, listener, name, others) } : {}),
      },
    );
    return undefined;
  }
  const handler: Handler | undefined = lowerComponentHandler(item, render);
  if (!handler) return undefined;
  return createListenerAttribute(event, handler, span(item));
}

/** The event an `onX` listens to: `onClear` → `clear`, `onLevelChange` → `levelChange`. */
function eventName(listener: string): string {
  const rest = listener.slice(2);
  return `${rest.charAt(0).toLowerCase()}${rest.slice(1)}`;
}

/**
 * Whether a component takes what falls through (ADR-0118): it has a fallthrough element. One
 * whose root is a component with no known API takes nothing, and UF3045 reports what is passed.
 */
function takesFallthrough(api: ComponentApi): boolean {
  return api.fallthroughTag !== undefined;
}

/**
 * The namespace of a fallthrough element's attributes: an `<svg>`'s, and an element's inside
 * one, are SVG's (ADR-0118).
 */
function namespaceOf(api: ComponentApi): Namespace {
  return api.fallthroughNamespace ?? (api.fallthroughTag === "svg" ? "svg" : "html");
}

/**
 * An attribute's name as Vue reads it for a prop (`camelize`): `aria-label` is `ariaLabel`.
 * Vue passes an attribute in kebab case to the prop of its camel case.
 */
function camelize(name: string): string {
  return name.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * An attribute whose camel case is a prop or a model of the component (UF3035), as `aria-label`
 * is the prop `ariaLabel`'s: Vue passes it to the prop, and the others let it fall through, so
 * it is reported, with the prop's own name as its fix. Returns whether it reported.
 */
function kebabMember(
  item: AST.JSXAttribute,
  name: AST.JSXIdentifier,
  api: ComponentApi,
  info: ComponentInfo,
  render: RenderContext,
  items: readonly AST.JSXAttributeItem[] | undefined,
): boolean {
  if (!name.name.includes("-")) return false;
  const camel = camelize(name.name);
  const prop = api.props.find((each) => each.name === camel);
  const model = prop ? undefined : api.models.find((each) => each.name === camel);
  if (!prop && !model) return false;
  const others = items?.flatMap((each) =>
    each !== item && each.type === "JSXAttribute" && each.name.type === "JSXIdentifier"
      ? [each.name.name]
      : [],
  );
  render.reporter.report(
    "UF3035",
    name,
    `\`${name.name}\` is written for ${info.name}'s ${prop ? "prop" : "model"} \`${camel}\`, in kebab case: Vue passes it to the ${prop ? "prop" : "model"}, and the other targets let it fall through as an attribute.`,
    prop
      ? {
          help: `Pass the prop by its own name, \`${camel}\`.`,
          fixes: renameFix(camel, camel, name, others),
        }
      : { help: `Bind the model by its own name, \`v-model:${camel}={…}\`.` },
  );
  return true;
}

/**
 * A name a consumer passes that would fall through, and that a root component declares
 * (ADR-0118): `onClick` on a component whose root component emits `click`. The targets do not
 * agree whether it reaches that component's own prop, model or event, or its element, so it is
 * reported (UF1002). Returns whether it reported.
 */
function reachesRootDeclaration(
  item: AST.JSXAttribute,
  name: AST.JSXIdentifier,
  api: ComponentApi,
  info: ComponentInfo,
  render: RenderContext,
): boolean {
  const listener = /^on[A-Z]/.test(name.name);
  const event = listener ? eventName(withoutOption(name.name)) : undefined;
  const declaration = api.rootDeclarations?.find((each) =>
    each.kind === "event"
      ? each.name === event
      : !listener && (each.name === name.name || each.name === camelize(name.name)),
  );
  if (!declaration) return false;
  const what =
    declaration.kind === "event"
      ? `\`${declaration.name}\` event`
      : `${declaration.kind} \`${declaration.name}\``;
  render.reporter.unsupported(
    item.name,
    `\`${name.name}\` reaches ${declaration.component}'s own ${what} through ${info.name}'s root, and what falls through to a root component's own declarations is not supported yet (ADR-0118).`,
    {
      help: `Pass it to ${declaration.component} directly, or declare it on ${info.name}.`,
    },
  );
  return true;
}

/** A listener's name without its option suffix: `onClickOnce` → `onClick`. */
function withoutOption(listener: string): string {
  const suffix = OPTION_SUFFIXES.find((each) => listener.endsWith(each));
  return suffix ? listener.slice(0, -suffix.length) : listener;
}

/**
 * Whether an attribute a component does not declare falls through (ADR-0118): it names no prop,
 * model or slot of the component, and it is an attribute of the element it lands on, or of any
 * element where the component takes nothing, which UF3045 then reports.
 */
function passesAttribute(attribute: string, api: ComponentApi): boolean {
  if (
    api.props.some((each) => each.name === attribute) ||
    api.models.some((each) => each.name === attribute) ||
    api.slots.some((each) => each.name === attribute) ||
    attribute.toLowerCase() === "innerhtml"
  ) {
    return false;
  }
  const tag = api.fallthroughTag ?? "div";
  const namespace = namespaceOf(api);
  return isAttributeOf(tag, namespace, canonicalName(tag, namespace, attribute));
}

/**
 * Whether a listener on a component is a native listener that falls through (ADR-0118): it
 * listens to no event the component declares, with or without an option suffix, and to a DOM
 * event.
 */
export function passesListener(attribute: string, api: ComponentApi): boolean {
  const event = eventName(attribute);
  if (api.events.some((each) => each.name === event)) return false;
  const suffix = OPTION_SUFFIXES.find((each) => attribute.endsWith(each));
  if (
    suffix &&
    api.events.some((each) => each.name === eventName(attribute.slice(0, -suffix.length)))
  ) {
    return false;
  }
  const listener = listenerName(attribute);
  return listener !== undefined && isElementEvent(listener.event);
}

/**
 * What falls through a component (ADR-0054, ADR-0118): its `class`, its `style`, the attributes
 * it does not declare and its native listeners, lowered as the fallthrough element's own would
 * be, then passed to it. UF3045 reports them where the component takes nothing.
 */
function lowerFallthrough(
  items: readonly AST.JSXAttribute[],
  opening: AST.JSXOpeningElement,
  api: ComponentApi,
  info: ComponentInfo,
  render: RenderContext,
): ComponentAttribute[] {
  if (!items.length) return [];
  const { reporter } = render;
  // A `<component is>` root over tags, or a root component that renders one, takes only `class`
  // and `style` (ADR-0119): no target places anything else on it yet (ADR-0118).
  if (!takesFallthrough(api) && api.inheritAttrs && api.rootTags !== undefined) {
    return lowerClassAndStyle(items, opening, api, info, render);
  }
  if (!takesFallthrough(api)) {
    const dropped =
      api.inheritAttrs === false
        ? `${info.name} sets \`inheritAttrs: false\` and spreads no \`...rest\`, so it renders nothing passed to it that it does not declare`
        : api.rootUnlisted
          ? `${info.name}'s root is a \`<component is>\` whose \`is\` reads a value ${info.name}'s API can't list the tags of, so no target knows where what it does not declare goes`
          : api.root === "component"
            ? `${info.name}'s root component takes nothing it does not declare, so ${info.name} renders nothing passed to it that it does not declare`
            : `${info.name}'s root is not one element or one component, so no target knows where what it does not declare goes`;
    for (const item of items) {
      reporter.report("UF3045", item.name, `${dropped}.`, {
        help:
          api.inheritAttrs === false
            ? `Pass what ${info.name} declares, or spread the props' rest on one of its elements: \`<input {...rest} />\`.`
            : api.rootUnlisted
              ? `Choose ${info.name}'s root tag with a literal, a conditional of literals or a prop typed as a union of tags, \`is={href ? "a" : "button"}\`, or pass what it declares.`
              : `Give ${info.name} one root element, or pass what it declares.`,
      });
    }
    return [];
  }
  const tag = api.fallthroughTag!;
  const lowered = lowerAttributes(
    { ...opening, attributes: [...items] },
    {
      tag,
      namespace: namespaceOf(api),
      hasChildren: false,
      listBody: false,
      render,
      fallthrough: { own: api.fallthroughOwn },
    },
  );
  return lowered.attributes.flatMap((attribute): ComponentAttribute[] => {
    switch (attribute.kind) {
      case "Class":
      case "Style":
      case "Bound":
        return [attribute];
      // A static `class` lowers to a static attribute on an element, and is one class here.
      case "Static":
        if (attribute.name !== "class") return [attribute];
        return attribute.value === true
          ? []
          : [
              createClassAttribute(
                [createStaticClass(attribute.value, attribute.span)],
                attribute.span,
              ),
            ];
      case "Event":
        if (attribute.capture || attribute.once || attribute.passive) {
          reporter.unsupported(
            { start: attribute.span.start, end: attribute.span.end },
            "A listener option on a listener that falls through to a component's root is not supported yet (ADR-0118).",
            { help: "Listen without the option, or on an element inside the component." },
          );
          return [];
        }
        return [attribute];
      default:
        return [];
    }
  });
}

/**
 * What falls through to a `<component is>` root over tags, or to a root component that renders
 * one (ADR-0119): its `class` and `style`, lowered as the first tag's, since both are global, so
 * the tag can't change them. Anything else is not supported yet (ADR-0118, ADR-0119).
 */
function lowerClassAndStyle(
  items: readonly AST.JSXAttribute[],
  opening: AST.JSXOpeningElement,
  api: ComponentApi,
  info: ComponentInfo,
  render: RenderContext,
): ComponentAttribute[] {
  const passed = items.filter((item) => {
    const written = item.name.type === "JSXIdentifier" ? item.name.name : "";
    if (written === "class" || written === "style") return true;
    render.reporter.unsupported(
      item.name,
      `What falls through to ${info.name}'s \`<component is>\` root is not supported yet: \`class\` and \`style\` do.`,
      { help: `Pass what ${info.name} declares, or give ${info.name} one root element.` },
    );
    return false;
  });
  if (!passed.length) return [];
  const lowered = lowerAttributes(
    { ...opening, attributes: passed },
    {
      tag: api.rootTags?.[0] ?? "div",
      namespace: "html",
      hasChildren: false,
      listBody: false,
      render,
    },
  );
  return lowered.attributes.flatMap((attribute): ComponentAttribute[] => {
    switch (attribute.kind) {
      case "Class":
      case "Style":
        return [attribute];
      // A static `class` lowers to a static attribute on an element, and is one class here.
      case "Static":
        if (attribute.name !== "class") return [attribute];
        return attribute.value === true
          ? []
          : [
              createClassAttribute(
                [createStaticClass(attribute.value, attribute.span)],
                attribute.span,
              ),
            ];
      default:
        return [];
    }
  });
}

/** Whether a spread spreads the props' rest, `{...rest}` (ADR-0118). */
export function isRestSpread(item: AST.JSXSpreadAttribute, render: RenderContext): boolean {
  if (item.argument.type !== "Identifier" || !render.restProps) return false;
  const resolution = render.scopes.resolve(item.argument);
  return resolution.kind === "parameter" && resolution.declaration === render.restProps.declaration;
}

/**
 * A component's fills (ADR-0054): its children as the default slot's, or one slot object whose
 * members fill the named slots (UF3040), each a slot the component declares (UF3038). `fixable`
 * is false on `<component is>`, whose candidates may each mean another slot.
 */
function lowerFills(
  node: AST.JSXElement,
  api: ComponentApi,
  info: ComponentInfo,
  render: RenderContext,
  fixable: boolean,
): SlotFill[] | undefined {
  const { reporter } = render;
  const content = node.children.filter((child) => hasContent([child]));
  if (!content.length) return [];
  const [only] = content;
  const object =
    content.length === 1 &&
    only!.type === "JSXExpressionContainer" &&
    only!.expression.type === "ObjectExpression"
      ? only!.expression
      : undefined;
  const objects = content.filter(
    (child) =>
      child.type === "JSXExpressionContainer" && child.expression.type === "ObjectExpression",
  );
  if (!object && objects.length) {
    reporter.report(
      "UF3040",
      objects[0]!,
      "A slot object is a component's only child: its members fill the slots, the default one included.",
      { help: "Move the other children into the slot object's `default` member." },
    );
    return undefined;
  }
  if (object) return lowerSlotObject(object, api, info, render, fixable);
  if (!declares(api, "default")) {
    reporter.report(
      "UF3038",
      { start: content[0]!.start, end: content.at(-1)!.end },
      `${info.name} declares no default slot, so it renders no children.`,
      {
        help: `Declare one in ${info.name} with \`defineSlots<{ default?(): Element }>()\`, or remove the children.`,
      },
    );
    return undefined;
  }
  const at = { start: content[0]!.start, end: content.at(-1)!.end };
  const forwarded = forwardedDefault(content, render);
  if (forwarded) return [createSlotFill("default", [], at, { forward: "default" })];
  const children = lowerChildren(node.children, FILL, inFill(render));
  return children.length ? [createSlotFill("default", children, at)] : [];
}

/** Whether a component declares a slot. */
function declares(api: ComponentApi, slot: string): boolean {
  return api.slots.some((each) => each.name === slot);
}

/**
 * Children that are only `{slots.default?.()}`, with no fallback: the parent's default slot
 * forwarded (ADR-0054), which lowers to the fill `{{ default: slots.default }}` lowers to.
 */
function forwardedDefault(content: readonly AST.JSXChild[], render: RenderContext): boolean {
  const [only] = content;
  if (content.length !== 1 || only?.type !== "JSXExpressionContainer") return false;
  if (only.expression.type === "JSXEmptyExpression") return false;
  const call = slotCall(only.expression, render);
  if (call?.slot !== "default" || call.node.arguments.length || !call.optional) return false;
  // Forwarding the default slot needs one to forward, as a slot object's `slots.default` does.
  if (!render.slots?.slots.some((each) => each.name === "default")) {
    render.reporter.report(
      "UF3041",
      call.node,
      "`default` is no slot of this component, so there is nothing to forward.",
      { help: "Declare a default slot with `defineSlots`, or pass children of its own." },
    );
  }
  return true;
}

/**
 * The render context of a fill's content (ADR-0054): a function the child may call many times,
 * or none, so what renders once, the props' rest (ADR-0118), cannot be in it.
 */
function inFill(render: RenderContext): RenderContext {
  return render.fill ? render : { ...render, fill: true };
}

/** Where a fill's content is lowered: inside a component, whose DOM parent the child decides. */
export const FILL: Place = { ancestors: [], namespace: "html", fill: true };

/** The fills a slot object writes (ADR-0054). */
function lowerSlotObject(
  object: AST.ObjectExpression,
  api: ComponentApi,
  info: ComponentInfo,
  render: RenderContext,
  fixable: boolean,
): SlotFill[] | undefined {
  const { reporter } = render;
  const fills: SlotFill[] = [];
  let valid = true;
  const invalid = (at: { start: number; end: number }, message: string) => {
    reporter.report("UF3040", at, message, {
      help: "Write each member as a slot's name and an arrow function that returns JSX: `{{ title: () => <h2>Title</h2>, item: ({ item }) => <b>{item.label}</b> }}`.",
    });
    valid = false;
  };
  /** Each slot filled so far, by the key that fills it: a slot is filled once (UF3007). */
  const filled = new Map<string, AST.PropertyKey>();
  for (const property of object.properties) {
    if (property.type !== "Property" || property.computed || property.kind !== "init") {
      invalid(property, "A slot object's member is a slot's name and an arrow function.");
      continue;
    }
    const slot =
      property.key.type === "Identifier"
        ? property.key.name
        : property.key.type === "Literal" && typeof property.key.value === "string"
          ? property.key.value
          : undefined;
    if (slot === undefined) {
      invalid(property.key, "A slot object's key is a slot's name.");
      continue;
    }
    const first = filled.get(slot);
    if (first) {
      reporter.report("UF3007", property.key, `The slot \`${slot}\` is filled twice.`, {
        help: "Keep one: the targets disagree about which fill wins.",
        related: [{ span: span(first), message: "First filled here" }],
      });
      valid = false;
      continue;
    }
    filled.set(slot, property.key);
    if (!declares(api, slot)) {
      const meant = closest(
        slot,
        api.slots.map((each) => each.name),
      );
      // A shorthand member's key is its value too, which the rename would change; a method's
      // fill is UF3040 once renamed.
      const others =
        fixable && !property.shorthand && !property.method
          ? object.properties.flatMap((each) =>
              each === property || each.type !== "Property"
                ? []
                : each.key.type === "Identifier"
                  ? [each.key.name]
                  : each.key.type === "Literal" && typeof each.key.value === "string"
                    ? [each.key.value]
                    : [],
            )
          : undefined;
      const text =
        meant && property.key.type === "Identifier" && /^[A-Za-z_$][\w$]*$/.test(meant)
          ? meant
          : JSON.stringify(meant);
      reporter.report(
        "UF3038",
        property.key,
        `${info.name} declares no slot \`${slot}\`.${meant ? ` Did you mean \`${meant}\`?` : ""}`,
        {
          help: `Fill a slot ${info.name} declares with \`defineSlots\`.`,
          ...(meant ? { fixes: renameFix(meant, text, property.key, others) } : {}),
        },
      );
      valid = false;
      continue;
    }
    const at = span(property);
    const { value } = property;
    const forwarded = value.type === "MemberExpression" ? forwardedSlot(value, render) : undefined;
    if (forwarded !== undefined) {
      fills.push(createSlotFill(slot, [], at, { forward: forwarded }));
      continue;
    }
    if (
      value.type !== "ArrowFunctionExpression" ||
      value.async ||
      value.body.type === "BlockStatement"
    ) {
      invalid(
        value,
        `The slot \`${slot}\`'s fill is an arrow function whose body is the JSX it renders, or the parent's own slot (\`slots.${slot}\`).`,
      );
      continue;
    }
    if (value.typeParameters || value.returnType) {
      invalid(value, "A fill takes no type parameters or return type: the slot declares them.");
      continue;
    }
    if (value.params.length > 1) {
      invalid(value.params[1]!, "A fill takes one parameter at most: the slot's props.");
      continue;
    }
    const scoped = api.slots.find((each) => each.name === slot)?.props !== undefined;
    const [param] = value.params;
    if (param && !scoped) {
      invalid(param, `The slot \`${slot}\` passes no props, so its fill takes no parameter.`);
      continue;
    }
    const variables: LoopVariable[] = [];
    let parameter: Parameter | undefined;
    if (param) {
      const read = fillParameter(param, render);
      if (!read) {
        valid = false;
        continue;
      }
      ({ parameter } = read);
      variables.push(...read.variables);
    }
    for (const variable of variables) render.loopVariables.set(variable.declaration, variable);
    const children = lowerContent(value.body, FILL, inFill(render));
    fills.push(createSlotFill(slot, children, at, parameter ? { parameter } : {}));
  }
  if (!valid) return undefined;
  // The default slot's fill comes first, as the children's would (ADR-0055).
  return fills.toSorted((a, b) => Number(b.slot === "default") - Number(a.slot === "default"));
}

/** The slot of this component a member expression forwards: `slots.title`. */
function forwardedSlot(node: AST.MemberExpression, render: RenderContext): string | undefined {
  if (node.object.type !== "Identifier" || node.computed || node.optional) return undefined;
  if (node.property.type !== "Identifier") return undefined;
  const binding = setupBindingOf(node.object, render);
  if (binding?.kind !== "slots") return undefined;
  const slot = node.property.name;
  if (render.slots?.slots.some((each) => each.name === slot)) return slot;
  render.reporter.report(
    "UF3041",
    node,
    `\`${slot}\` is no slot of this component, so there is nothing to forward.`,
    { help: "Forward a slot the component declares with `defineSlots`." },
  );
  return "";
}

/**
 * A scoped fill's parameter (ADR-0054): an identifier, or an object pattern of names, each a
 * `slotScope` binding, without types or defaults (UF3040).
 */
function fillParameter(
  param: AST.ParamPattern,
  render: RenderContext,
): { parameter: Parameter; variables: LoopVariable[] } | undefined {
  const { reporter, source } = render;
  const invalid = (at: { start: number; end: number }) => {
    reporter.report(
      "UF3040",
      at,
      "A fill's parameter is the slot's props, as a name or an object pattern of names: `({ item })`, with no types or defaults, which the slot declares.",
      { help: "Write `({ item })`, or `(props)` and read `props.item`." },
    );
    return undefined;
  };
  if (param.type !== "Identifier" && param.type !== "ObjectPattern") return invalid(param);
  if (param.typeAnnotation || param.optional) return invalid(param.typeAnnotation ?? param);
  const identifiers: AST.BindingIdentifier[] = [];
  if (param.type === "Identifier") identifiers.push(param);
  else {
    for (const property of param.properties) {
      if (
        property.type !== "Property" ||
        property.computed ||
        property.value.type !== "Identifier"
      ) {
        return invalid(property);
      }
      identifiers.push(property.value);
    }
  }
  const variables: LoopVariable[] = [];
  for (const identifier of identifiers) {
    if (shadowing(identifier, render)) return undefined;
    const binding = createBinding(identifier.name, "slotScope", {
      start: identifier.start,
      end: identifier.start + identifier.name.length,
    });
    render.bindings.push(binding);
    variables.push({
      name: identifier.name,
      id: binding.id,
      kinds: UNKNOWN,
      declaration: identifier,
    });
  }
  const at = span(param);
  const parameter =
    param.type === "Identifier"
      ? createParameter(param.name, at)
      : createParameter(
          createParameterPattern(
            source.slice(param.start, param.end),
            identifiers.map((identifier) => identifier.name),
            at,
          ),
          at,
        );
  return { parameter, variables };
}

/** A call of one of the component's slots, `slots.title?.(…)`, with whether it is optional. */
export function slotCall(
  expression: AST.Expression,
  render: RenderContext,
): { slot: string; node: AST.CallExpression; optional: boolean } | undefined {
  const call =
    expression.type === "ChainExpression" && expression.expression.type === "CallExpression"
      ? expression.expression
      : expression.type === "CallExpression"
        ? expression
        : undefined;
  const callee = call?.callee;
  if (
    !call ||
    callee?.type !== "MemberExpression" ||
    callee.computed ||
    callee.optional ||
    callee.object.type !== "Identifier" ||
    callee.property.type !== "Identifier"
  ) {
    return undefined;
  }
  if (setupBindingOf(callee.object, render)?.kind !== "slots") return undefined;
  return { slot: callee.property.name, node: call, optional: call.optional };
}

/**
 * A slot rendered as a child (ADR-0054): `{slots.title?.()}`, `{slots.item?.({ item })}`, with
 * the fallback after `??`. Returns `undefined` for an expression that renders no slot.
 */
export function lowerSlotOutlet(
  expression: AST.Expression,
  at: Span,
  place: Place,
  render: RenderContext,
): { node: SlotOutletNode | undefined } | undefined {
  const fallbackNode =
    expression.type === "LogicalExpression" && expression.operator === "??"
      ? expression.right
      : undefined;
  const called = slotCall(
    fallbackNode ? (expression as AST.LogicalExpression).left : expression,
    render,
  );
  if (!called) return undefined;
  const { reporter } = render;
  const { slot, node, optional } = called;
  const declared = render.slots?.slots.find((each) => each.name === slot);
  const invalid = (where: { start: number; end: number }, message: string, help: string) => {
    reporter.report("UF3041", where, message, { help });
    return { node: undefined };
  };
  if (!declared) {
    return invalid(
      node.callee,
      `\`${slot}\` is no slot of this component: \`defineSlots\` declares the slots it renders.`,
      "Declare the slot with `defineSlots`, or render one it declares.",
    );
  }
  if (!optional) {
    return invalid(
      node,
      `\`slots.${slot}\` is called without \`?.\`: a slot is optional, and renders nothing where the parent leaves it empty.`,
      `Write \`slots.${slot}?.()\`.`,
    );
  }
  const [argument, ...more] = node.arguments;
  if (more.length || argument?.type === "SpreadElement") {
    return invalid(
      node,
      `\`slots.${slot}\` takes one argument at most: its props.`,
      "Pass one object of props.",
    );
  }
  if ((argument !== undefined) !== (declared.props !== undefined)) {
    return invalid(
      node,
      argument
        ? `\`slots.${slot}\` passes props, and the slot declares none.`
        : `\`slots.${slot}\` declares props, and is rendered without them.`,
      declared.props
        ? `Pass its props: \`slots.${slot}?.({ … })\`.`
        : `Write \`slots.${slot}?.()\`.`,
    );
  }
  if (argument && argument.type !== "ObjectExpression") {
    return invalid(
      argument,
      `\`slots.${slot}\`'s props are an object literal: \`slots.${slot}?.({ item })\`, which every target passes key by key.`,
      "Write the props as an object literal.",
    );
  }
  const problem = textPlacementProblem(place, render);
  if (problem) {
    problem("A slot", at);
    return { node: undefined };
  }
  const mark = reporter.diagnostics.length;
  const props = argument ? checkExpression(argument, render) : undefined;
  const fallback = fallbackNode ? lowerContent(fallbackNode, place, render) : [];
  if ((props && !props.clean) || reporter.hasErrorsSince(mark)) return { node: undefined };
  return {
    node: createSlotOutlet(slot, fallback, at, props?.expression),
  };
}
