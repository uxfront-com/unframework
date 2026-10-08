// Composition in templates (ADR-0053, ADR-0054): a component element, `<Field label="Name"
// onClear={reset} />`, with its props, listeners, fallthrough `class` and `style`, ref and slot
// fills; and a component's own slots, rendered (`{slots.title?.()}`, with fallback after `??`)
// and forwarded (`{{ title: slots.title }}`). A component element names an imported component,
// one of the module's own, or the component itself, by the API read from its declarations
// (`./api.ts`); what that API does not declare is reported (layer 2 of §5.6, whose did-you-mean
// and fixes are the cross-component checks' to add).

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
} from "@unframework/ir";
import type {
  ComponentApi,
  ComponentAttribute,
  ComponentNode,
  Handler,
  Parameter,
  SlotFill,
  SlotOutletNode,
  Span,
} from "@unframework/ir";
import type { AST } from "@unframework/parser";

import { typeMembers } from "./api.ts";
import { keyCase, lowerAttributes, misplacedKey } from "./attributes.ts";
import { checkPlacement } from "./elements.ts";
import { checkExpression, shadowing, span } from "./expressions.ts";
import { lowerComponentHandler, lowerRef } from "./listeners.ts";
import { hasContent, lowerChildren, lowerContent, textPlacementProblem } from "./lower.ts";
import type { Place } from "./lower.ts";
import type { ComponentInfo, LoopVariable, RenderContext } from "./render.ts";
import { setupBindingOf } from "./render.ts";
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
  const { reporter } = render;
  const mark = reporter.diagnostics.length;
  const info = componentOf(name, render);
  if (!info) {
    // A name an unresolved import binds is reported where it is imported (UF1202).
    if (info === undefined) unknownComponent(node, name, render);
    // Its content is still checked, as an element's is once its tag is reported.
    lowerChildren(node.children, FILL, render);
    return { node: undefined, key: undefined };
  }
  const { api } = info;
  // Its root element is checked where the component sits, as the element would be there
  // (ADR-0054): a root that lives only inside a given parent (`<li>`, `<tr>`) is checked against
  // the element around the component, which only the parent's compile knows. With no element
  // around it (a slot's fill, this component's own root), nothing places such a root.
  if (api.rootTag !== undefined) {
    checkPlacement(api.rootTag, name, place.ancestors, reporter, false);
  }
  const attributes: ComponentAttribute[] = [];
  const fallthrough: AST.JSXAttribute[] = [];
  let key: AST.JSXAttribute | undefined;
  let after = name.end;
  /** Each name set so far: a component takes each once, as an element does (UF3007). */
  const seen = new Map<string, AST.JSXAttribute>();
  for (const item of node.openingElement.attributes) {
    const previous = after;
    after = item.end;
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
      reporter.unsupported(
        item,
        "A spread on a component is not supported: a component takes each prop by its name.",
        { help: "Pass each prop as an attribute of its own: `label={field.label}`." },
      );
      continue;
    }
    if (item.name.type === "JSXNamespacedName") {
      const written = `${item.name.namespace.name}:${item.name.name.name}`;
      reporter.unsupported(
        item.name,
        written.startsWith("v-model:")
          ? `\`${written}\` binds a model, and component models are not supported yet.`
          : `\`${written}\` is not an attribute a component takes.`,
      );
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
    if (attribute === "v-model") {
      reporter.unsupported(
        item.name,
        "`v-model` on a component binds a model, and component models are not supported yet.",
      );
      continue;
    }
    if (/^on[A-Z]/.test(attribute)) {
      const listener = lowerComponentListener(item, item.name, api, info, render);
      if (listener) attributes.push(listener);
      continue;
    }
    const prop = lowerProp(item, item.name, api, info, render);
    if (prop) attributes.push(prop);
  }
  attributes.push(...lowerFallthrough(fallthrough, node.openingElement, api, info, render));
  const fills = lowerFills(node, api, info, render);
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
    return report(
      `\`${info.name}\` exposes nothing, so a ref on it holds nothing a parent can call.`,
      `Expose the functions a parent calls from ${info.name} with \`defineExpose({ … })\`, or remove the ref.`,
    );
  }
  const exposed = api.exposes.map((name) => `\`${name}\``).join(", ");
  const type = templateRefType(binding, render);
  const members = type ? typeMembers(type, render.types) : undefined;
  if (!members) {
    return report(
      `The template ref on \`${info.name}\` is not typed as an object type of what it exposes (${exposed}): a call through it could name anything.`,
      `Type it with what ${info.name} exposes: \`useTemplateRef<{ ${api.exposes[0]}(): void }>()\`.`,
    );
  }
  for (const member of members) {
    const name =
      (member.type === "TSPropertySignature" || member.type === "TSMethodSignature") &&
      !member.computed &&
      member.key.type === "Identifier"
        ? member.key.name
        : undefined;
    if (name !== undefined && api.exposes.includes(name)) continue;
    return report(
      `The template ref's type names ${name === undefined ? "a member" : `\`${name}\``}, which \`${info.name}\` does not expose: it exposes ${exposed}.`,
      `Type the ref with what ${info.name} exposes, or expose ${name === undefined ? "the member" : `\`${name}\``} from it.`,
    );
  }
  return false;
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
function componentOf(
  name: AST.JSXIdentifier,
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

/** The name among `names` closest to `name`, when one is close: a likely misspelling. */
export function closest(name: string, names: readonly string[]): string | undefined {
  let best: { name: string; distance: number } | undefined;
  for (const candidate of names) {
    const distance = editDistance(name.toLowerCase(), candidate.toLowerCase());
    if (distance <= Math.max(1, Math.floor(candidate.length / 3))) {
      if (!best || distance < best.distance) best = { name: candidate, distance };
    }
  }
  return best?.name;
}

/**
 * The edit distance between two strings, a swap of two neighbours counting as one edit, as a
 * typo makes it (`lable`, `Feild`).
 */
function editDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(rows[i - 1]![j]! + 1, rows[i]![j - 1]! + 1, rows[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, rows[i - 2]![j - 2]! + 1);
      }
      rows[i]![j] = best;
    }
  }
  return rows[a.length]![b.length]!;
}

/**
 * A prop (ADR-0053): a name the component declares, with a static string or an expression. Any
 * other name is UF3035.
 */
function lowerProp(
  item: AST.JSXAttribute,
  name: AST.JSXIdentifier,
  api: ComponentApi,
  info: ComponentInfo,
  render: RenderContext,
): ComponentAttribute | undefined {
  const { reporter, source } = render;
  if (!api.props.some((prop) => prop.name === name.name)) {
    const meant = closest(
      name.name,
      api.props.map((prop) => prop.name),
    );
    reporter.report(
      "UF3035",
      name,
      `${info.name} declares no prop \`${name.name}\`: a component takes its props, \`class\`, \`style\`, \`key\`, \`ref\`, its events' listeners and its slots.${meant ? ` Did you mean \`${meant}\`?` : ""}`,
      { help: `Pass a prop ${info.name} declares, or declare \`${name.name}\` in its props.` },
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
    return createPropAttribute(name.name, createExpression(raw, span(value)), span(item));
  }
  if (value.type !== "JSXExpressionContainer" || value.expression.type === "JSXEmptyExpression") {
    reporter.unsupported(value, "A prop's value is a string or an expression in braces.");
    return undefined;
  }
  const checked = checkExpression(value.expression, render);
  if (!checked.clean) return undefined;
  return createPropAttribute(name.name, checked.expression, span(item));
}

/**
 * A listener of an event the component declares (ADR-0053): `onClear` for `clear`. A listener's
 * option suffix is UF3043, an event it does not declare UF3036.
 */
function lowerComponentListener(
  item: AST.JSXAttribute,
  name: AST.JSXIdentifier,
  api: ComponentApi,
  info: ComponentInfo,
  render: RenderContext,
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
    const meant = closest(
      event,
      api.events.map((each) => each.name),
    );
    reporter.report(
      "UF3036",
      name,
      `${info.name} declares no event \`${event}\`: a component passes no DOM listener through to its root, and \`${name.name}\` listens to an event the component emits.${meant ? ` Did you mean \`on${meant.charAt(0).toUpperCase()}${meant.slice(1)}\`?` : ""}`,
      {
        help: `Listen to an event ${info.name} declares with \`defineEmits\`, or listen on an element inside it.`,
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
 * A component's `class` and `style` (ADR-0054): lowered as an element's are, then merged into
 * the component's root, which UF3045 reports where the component renders neither.
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
  const dropped =
    api.inheritAttrs === false
      ? `${info.name} sets \`inheritAttrs: false\`, so it renders no \`class\` or \`style\` passed to it`
      : api.root === "other"
        ? `${info.name}'s root is not one element or one component, so no target knows where a \`class\` or a \`style\` passed to it goes`
        : undefined;
  if (dropped) {
    for (const item of items) {
      reporter.report("UF3045", item.name, `${dropped}.`, {
        help:
          api.inheritAttrs === false
            ? `Pass what ${info.name} declares, or remove \`defineOptions({ inheritAttrs: false })\`.`
            : `Give ${info.name} one root element, or pass a prop it declares.`,
      });
    }
    return [];
  }
  const lowered = lowerAttributes(
    { ...opening, attributes: [...items] },
    {
      tag: api.rootTag ?? "div",
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

/**
 * A component's fills (ADR-0054): its children as the default slot's, or one slot object whose
 * members fill the named slots (UF3040), each a slot the component declares (UF3038).
 */
function lowerFills(
  node: AST.JSXElement,
  api: ComponentApi,
  info: ComponentInfo,
  render: RenderContext,
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
  if (object) return lowerSlotObject(object, api, info, render);
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
  const children = lowerChildren(node.children, FILL, render);
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

/** Where a fill's content is lowered: inside a component, whose DOM parent the child decides. */
const FILL: Place = { ancestors: [], namespace: "html", fill: true };

/** The fills a slot object writes (ADR-0054). */
function lowerSlotObject(
  object: AST.ObjectExpression,
  api: ComponentApi,
  info: ComponentInfo,
  render: RenderContext,
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
      reporter.report(
        "UF3038",
        property.key,
        `${info.name} declares no slot \`${slot}\`.${meant ? ` Did you mean \`${meant}\`?` : ""}`,
        { help: `Fill a slot ${info.name} declares with \`defineSlots\`.` },
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
    const children = lowerContent(value.body, FILL, render);
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
