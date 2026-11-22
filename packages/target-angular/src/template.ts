// An Angular component's template (plan §6, ADR-0035): the markup printed by the Angular dialect,
// read through one `@let` per signal it uses (an input, a state, a derived value, a setup-once
// constant), with its listeners written as template statements (./listeners.ts).
import {
  angularCode,
  angularDialect,
  printMarkup,
  spreadStyleExpression,
  staticClassValue,
  test,
  vueClassValue,
} from "@unframework.dev/codegen";
import type { ClassPart, MarkupDialect, PrintedAttribute } from "@unframework.dev/codegen";
import { BINDABLE_BOOLEAN_ATTRIBUTES, expressionsOf, walk } from "@unframework.dev/ir";
import type {
  Attribute,
  BindingId,
  ClassItem,
  ComponentAttribute,
  ComponentNode,
  DynamicNode,
  ElementNode,
  Expression,
  FragmentNode,
  StyleDeclaration,
} from "@unframework.dev/ir";

import { selectorOf } from "./composition.ts";
import type { Composition } from "./composition.ts";
import {
  TELEPORT_ATTRIBUTE,
  TELEPORT_HOST_INPUT,
  TRANSITION_APPEAR_INPUT,
  TRANSITION_ATTRIBUTE,
  TRANSITION_BRANCH_INPUT,
  TRANSITION_REGION_ATTRIBUTE,
} from "./directives.ts";
import {
  ATTRIBUTES_INPUT,
  childApi,
  ELEMENT_REF,
  FALLTHROUGH_ATTRIBUTE,
  LISTENERS_INPUT,
} from "./fallthrough.ts";
import type { FallthroughPlan, RootElementPlan } from "./fallthrough.ts";
import type { Listeners } from "./listeners.ts";
import type { Models } from "./models.ts";
import { outputName } from "./outputs.ts";
import { bindingById, memberOf, unreachable } from "./plan.ts";
import type { Plan } from "./plan.ts";
import { readThroughLet, templateRules } from "./rules.ts";

/** The consumer's `style`, which the root merges over its own (ADR-0056). */
const CONSUMER_STYLE = "this.style()";
/** The consumer's attributes and listeners, which the root takes (ADR-0118). */
const CONSUMER_ATTRIBUTES = `this.${ATTRIBUTES_INPUT}()`;
const CONSUMER_LISTENERS = `this.${LISTENERS_INPUT}()`;

/** The template's indentation: two levels, inside the decorator's object. */
const INDENT = "  ";
const LEVEL = 2;

/** What the template reads, which decides its `@let` declarations and the class's visibility. */
export interface TemplateReads {
  /** The bindings the template's expressions and statements read, outside lists' keys. */
  read: ReadonlySet<BindingId>;
  /** The bindings lists' keys read, from the class (`track this.label()`). */
  keyed: ReadonlySet<BindingId>;
  /** The allowed globals the expressions read, each a member of its own name. */
  globals: readonly string[];
  /** The slots whose templates the template renders or tests, through their queries. */
  slots: ReadonlySet<string>;
  /** The `v-model`s' values, which the template writes as the state's signal (`this.name`). */
  signals: ReadonlySet<Expression>;
}

/**
 * The component's template: the `@let` declarations that read the signals it uses, each once,
 * then its markup. Angular drops whitespace at the template's edges and between a `@let` and
 * what follows it, so each can sit on a line of its own.
 *
 * Why `@let`: Angular's type checker narrows a template variable as TypeScript narrows a local
 * (`@if (phone) { {{ phone.length }} }`, `item && item.name`, `items[0] && items[0].id`), but
 * never a signal call, which it reads again each time (TS2532 on `phone() && phone().length`).
 * Through a variable, every expression the source wrote type-checks in the template as it does
 * in the source (L4). `this.label()` reads the input: the variable takes the binding's name, and
 * a name in a template means a template variable before a member. The props come first, in
 * member order, then the setup's signals in source order.
 *
 * A `track` expression may read only its own item, `$index` and the component's members
 * (NG8009), so a signal a list's key reads is read there from the class, `this.label()`, and
 * counts as no use of its variable (an unread `@let` is NG8112).
 */
export function template(
  plan: Plan,
  listeners: Listeners,
  reads: TemplateReads,
  composition: Composition,
  models: Models,
  fallthrough: { plan?: FallthroughPlan; rootElement?: RootElementPlan },
  scope?: { roots: ReadonlySet<string>; host: string },
  teleportHost?: string,
  transition?: { ref: string },
): string {
  const { component } = plan;
  // A setup that awaits renders its template, `@let`s included, once it resolves (ADR-0101).
  const level = plan.resolved === undefined ? LEVEL : LEVEL + 1;
  const pad = INDENT.repeat(level);
  const lets: string[] = [];
  const declare = (id: BindingId | undefined) => {
    if (id === undefined || !reads.read.has(id)) return;
    const binding = bindingById(plan, id);
    if (readThroughLet(plan, binding)) {
      lets.push(`${pad}@let ${binding.name} = this.${memberOf(plan, binding)}();`);
    }
  };
  for (const prop of component.props) declare(prop.binding);
  for (const item of component.setup) {
    if ("binding" in item) declare(item.binding);
    // A composable's returned refs, read through its call's holder (ADR-0069).
    if (item.kind === "Use") for (const member of item.members) declare(member.binding);
  }
  const dialect: MarkupDialect = {
    ...angularDialect,
    // `<ng-template ufTeleport="body">`, whose directive mounts it into `to` (ADR-0098).
    teleport: ({ node }) => [
      {
        kind: "wrapper",
        tag: "ng-template",
        attributes: [
          {
            name: TELEPORT_ATTRIBUTE,
            text: angularDialect.attribute(TELEPORT_ATTRIBUTE, node.to, ""),
          },
          // The root teleport, by its span: the tree printed is a copy (`models.render`).
          ...(teleportHost !== undefined &&
          component.render.kind === "Fragment" &&
          component.render.children[0]?.span.start === node.span.start
            ? [
                {
                  name: TELEPORT_HOST_INPUT,
                  text: `[${TELEPORT_HOST_INPUT}]="this.${teleportHost}"`,
                },
              ]
            : []),
        ],
        content: { kind: "nodes", nodes: node.children, container: node },
      },
    ],
    // `<ng-container [ufTransitionRegion]="(open) ? 0 : -1">` around the conditional, created
    // with each `<Transition>`, and on each element `<p [ufTransition]="'fade'"
    // [ufTransitionBranch]="0" #transition="ufTransition" (animate.leave)="transition.leave($event)">`.
    // The region tells the directive whether the transition has rendered before, so an element
    // that a condition around it shows again enters only with `appear`, and which branch is shown
    // as Angular removes the element. Its binding is outside the conditional, where Angular's
    // template check narrows no condition (ADR-0100).
    ...(transition && {
      transition: ({ node, container, branch }) => {
        const nodes = { kind: "nodes", nodes: node.children, container } as const;
        if (node.children[0]?.kind !== "If") return [nodes];
        return [
          {
            kind: "wrapper",
            tag: "ng-container",
            attributes: [
              {
                name: TRANSITION_REGION_ATTRIBUTE,
                text: `[${TRANSITION_REGION_ATTRIBUTE}]="${branch}"`,
              },
            ],
            content: nodes,
          },
        ];
      },
      transitionAttributes: ({ node, branch }) => [
        // Bound, so the element carries no attribute of the directive's.
        {
          name: TRANSITION_ATTRIBUTE,
          text: `[${TRANSITION_ATTRIBUTE}]="${angularString(node.name)}"`,
        },
        ...(node.appear
          ? [{ name: TRANSITION_APPEAR_INPUT, text: `[${TRANSITION_APPEAR_INPUT}]="true"` }]
          : []),
        ...(branch === undefined
          ? []
          : [
              { name: TRANSITION_BRANCH_INPUT, text: `[${TRANSITION_BRANCH_INPUT}]="${branch}"` },
              {
                name: `#${transition.ref}`,
                text: `#${transition.ref}="${TRANSITION_ATTRIBUTE}"`,
              },
              {
                name: "(animate.leave)",
                text: `(animate.leave)="${transition.ref}.leave($event)"`,
              },
            ]),
      ],
    }),
    componentTag: (name) => composition.tags.get(name) ?? selectorOf(name),
    // A child's output's listener runs the statement ./listeners.ts plans for it.
    componentEvent: ({ attribute }) => {
      const name = `(${outputName(attribute.event)})`;
      const statement = listeners.outputs.get(attribute)!;
      return [{ name, text: `${name}="${angularCode(statement, "event")}"` }];
    },
    modelAttribute: ({ attribute }) => models.attributes.get(attribute)!,
    // The element that takes what the consumer passes binds the directive that puts it there
    // (ADR-0118): the rest's element, or the root, which `withFallthrough` gives a `Rest`.
    restAttribute: () => [
      {
        name: `[${FALLTHROUGH_ATTRIBUTE}]`,
        text: `[${FALLTHROUGH_ATTRIBUTE}]="{ attributes: ${CONSUMER_ATTRIBUTES}, listeners: ${CONSUMER_LISTENERS} }"`,
      },
    ],
    // The element that takes the consumer's attributes, which binds the directive (its `Rest`),
    // binds its own of a name the consumer passes to the consumer's value (ADR-0118): the
    // directive writes the record only as it changes, and Angular writes the element's own
    // binding each time its value does, which would otherwise override the consumer's.
    boundAttribute: (name, code, context) =>
      context.element.attributes.some((attribute) => attribute.kind === "Rest")
        ? consumerFirst(name, code, context)
        : angularDialect.boundAttribute(name, code, context),
    // What a child does not declare goes into its records (ADR-0118), on the host, which so
    // carries no attribute and is unwrapped (ADR-0010).
    fallthroughAttributes: (passed, context) =>
      fallthroughRecords(passed, context, plan, fallthrough.plan),
    // A class part that may be an array or an object goes through `classNames` (ADR-0065).
    classAttribute: (written, context) => {
      const { classNames } = models;
      if (!classNames || !written.some((part) => part.kind === "Dynamic" && part.collection)) {
        return angularDialect.classAttribute(written, context);
      }
      // A component takes one string; a static name holding `{{` has no static spelling.
      const whole =
        context.element.tag.startsWith("uf-") ||
        written.some((part) => part.kind === "Static" && part.value.includes("{{"));
      const value = whole ? "" : staticClassValue(written);
      const parts = whole
        ? written.map((part): ClassPart =>
            part.kind === "Static" ? { kind: "Dynamic", value: JSON.stringify(part.value) } : part,
          )
        : written;
      const call = `${classNames}(${vueClassValue(parts)})`;
      return [
        ...(value ? [{ name: "class", text: angularDialect.attribute("class", value, "") }] : []),
        { name: "class", text: `[class]="${angularCode(call, "attribute")}"` },
      ];
    },
    // A style bound to one value that a merge spreads is an object first (ADR-0065): the root's
    // own beside the consumer's, and the one a component takes, whose root spreads it.
    styleAttribute: (written, context) => {
      const { styleObject } = models;
      const merged = context.element.tag.startsWith("uf-") || written.length > 1;
      const parts = written.map((part) =>
        styleObject && merged && part.property === "" && part.value !== CONSUMER_STYLE
          ? { ...part, value: `${styleObject}(${part.value})` }
          : part,
      );
      return angularDialect.styleAttribute(parts, context);
    },
  };
  const render = fallthrough.plan
    ? withFallthrough(models.render, fallthrough.plan)
    : models.render;
  const markup = printMarkup(render, dialect, {
    indent: INDENT,
    level,
    component,
    module: plan.module,
    rewrite: templateRules(plan, reads.signals),
    handler: (attribute) => listeners.statements.get(attribute),
    attribute: (attribute) =>
      attribute.kind === "Event"
        ? listeners.attributes.get(attribute)
        : models.options.get(attribute),
    // The child-root rule (ADR-0063): every root node, each candidate of a `<component is>`
    // included, binds the directive that gives it the scope attributes on the host.
    // And the root a ref on the component holds, where it exposes nothing (ADR-0118), carries the
    // template ref its `ufElement` query reads.
    scopeRootAttributes: ({ span }) => [
      ...(scope?.roots.has(`${span.start}:${span.end}`) ? [`[ufScope]="this.${scope.host}"`] : []),
      ...(fallthrough.rootElement && sameSpan(fallthrough.rootElement.root.span, span)
        ? [`#${ELEMENT_REF}`]
        : []),
    ],
  });
  // A slot's templates are projected here, so none counts as the default slot's content
  // (ADR-0056); an `<ng-template>` renders nothing where it is projected.
  const outer = INDENT.repeat(LEVEL);
  const selects = composition.slots.map(
    ({ attribute }) => `${outer}<ng-content select="[${attribute}]" />`,
  );
  const content = [...lets, markup].join("\n");
  return [
    plan.resolved === undefined
      ? content
      : `${outer}@if (${plan.resolved}()) {\n${content}\n${outer}}`,
    ...selects,
  ].join("\n");
}

/**
 * The render tree with what the consumer passes merged into the node that takes it (ADR-0056,
 * ADR-0118), the root or the rest's element: `this.class()` among its class's parts,
 * `this.style()` as its whole style, whose own declarations it overrides as Vue's merge does,
 * and the records of attributes and listeners, which an element takes through the fallthrough
 * directive, written where its `Rest` is, and a root component through its own inputs, merged
 * with the ones the component passes it itself (`fallthroughAttributes`).
 */
function withFallthrough(
  render: ElementNode | FragmentNode,
  fallthrough: FallthroughPlan,
): ElementNode | FragmentNode {
  const { target } = fallthrough;
  return mapNodes(render, (node) =>
    node.kind === target.kind &&
    node.span.start === target.span.start &&
    node.span.end === target.span.end
      ? takingPassed(node, fallthrough)
      : undefined,
  );
}

/** The node that takes what the consumer passes, with it merged in (see `withFallthrough`). */
function takingPassed(
  root: ElementNode | ComponentNode | DynamicNode,
  fallthrough: FallthroughPlan,
): ElementNode | ComponentNode | DynamicNode {
  const span = root.span;
  const expression = (code: string): Expression => ({ code, span, refs: [] });
  const attributes: (Attribute | ComponentAttribute)[] = [...root.attributes];
  const item: ClassItem = { kind: "Dynamic", value: expression("this.class()"), span };
  const classAt = attributes.findIndex((attribute) => attribute.kind === "Class");
  const found = attributes[classAt];
  if (found?.kind === "Class") attributes[classAt] = { ...found, items: [...found.items, item] };
  else attributes.push({ kind: "Class", items: [item], span });
  const declaration: StyleDeclaration = {
    kind: "Bound",
    property: "",
    value: expression(CONSUMER_STYLE),
    span,
  };
  const styleAt = attributes.findIndex((attribute) => attribute.kind === "Style");
  const style = attributes[styleAt];
  // A style bound to one value, or a spread's `style` key, is the root's own, which the
  // consumer's merges over (ADR-0065).
  const spreadAt = attributes.findIndex(
    (attribute) =>
      attribute.kind === "Spread" && attribute.keys.some((key) => key.name === "style"),
  );
  const spread = attributes[spreadAt];
  if (spread?.kind === "Spread") {
    const own: StyleDeclaration = {
      kind: "Bound",
      property: "",
      value: spreadStyleExpression(spread),
      span: spread.span,
    };
    attributes[spreadAt] = { ...spread, keys: spread.keys.filter((key) => key.name !== "style") };
    attributes.push({ kind: "Style", declarations: [own, declaration], span });
  } else if (style?.kind === "Style" && style.value) {
    const own: StyleDeclaration = { kind: "Bound", property: "", value: style.value, span };
    attributes[styleAt] = { kind: "Style", declarations: [own, declaration], span: style.span };
  } else if (style?.kind === "Style") {
    attributes[styleAt] = { ...style, declarations: [...style.declarations, declaration] };
  } else attributes.push({ kind: "Style", declarations: [declaration], span });
  if (fallthrough.passes && root.kind === "Element" && !fallthrough.rest) {
    // The root takes the records as the rest's element does: through the directive.
    attributes.push({ kind: "Rest", span });
  }
  if (fallthrough.passes && root.kind === "Component") {
    // A root component takes the consumer's records whole where the component passes it none
    // of its own, which `fallthroughAttributes` merges with them.
    const has = (...kinds: string[]) => attributes.some(({ kind }) => kinds.includes(kind));
    const prop = (name: string, code: string): ComponentAttribute => ({
      kind: "Prop",
      name,
      value: expression(code),
      span,
    });
    if (!has("Static", "Bound")) attributes.push(prop(ATTRIBUTES_INPUT, CONSUMER_ATTRIBUTES));
    if (!has("Event")) attributes.push(prop(LISTENERS_INPUT, CONSUMER_LISTENERS));
  }
  return { ...root, attributes } as ElementNode | ComponentNode | DynamicNode;
}

/**
 * A tree with each element, component or `<component is>` node `replace` gives another for
 * replaced, and every object on the way to it copied: the others, attributes included, are the
 * tree's own, which the listeners' and models' plans name.
 */
function mapNodes<T>(
  value: T,
  replace: (
    node: ElementNode | ComponentNode | DynamicNode,
  ) => ElementNode | ComponentNode | DynamicNode | undefined,
): T {
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item: unknown) => {
      const mapped = mapNodes(item, replace);
      if (mapped !== item) changed = true;
      return mapped;
    });
    return changed ? (next as T) : value;
  }
  if (value === null || typeof value !== "object") return value;
  const { kind } = value as { kind?: unknown };
  if (kind === "Element" || kind === "Component" || kind === "Dynamic") {
    const replaced = replace(value as unknown as ElementNode | ComponentNode | DynamicNode);
    if (replaced) return replaced as unknown as T;
  }
  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const mapped = key === "attributes" || key === "span" ? child : mapNodes(child, replace);
    if (mapped !== child) changed = true;
    next[key] = mapped;
  }
  return changed ? (next as T) : value;
}

/** What a component element passes through it, and the element's context (`MarkupDialect`). */
type FallthroughHook = Parameters<NonNullable<MarkupDialect["fallthroughAttributes"]>>;

/** Whether two spans are one. */
function sameSpan(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start === b.start && a.end === b.end;
}

/**
 * The records a component element binds for what falls through it (ADR-0118):
 * `[ufAttributes]="{ id: 'save', 'aria-pressed': pressed }"`, each attribute's value as
 * `[attr.name]` would bind it (a boolean attribute's `''` or `null`), and
 * `[ufListeners]="{ click: () => onSave() }"`, each listener's template statement in an arrow
 * whose parameter is `$event`. On the root component of a component that takes its own
 * consumer's, they merge with the consumer's: its attributes win, and its listener of an event
 * runs after the component's own, which the method the statement calls chains (./listeners.ts).
 */
function fallthroughRecords(
  passed: FallthroughHook[0],
  context: FallthroughHook[1],
  plan: Plan,
  own: FallthroughPlan | undefined,
): PrintedAttribute[] {
  const forwards =
    own !== undefined &&
    own.passes &&
    own.target.kind === "Component" &&
    sameSpan(own.target.span, context.component.span);
  const svg = childApi(plan.module, context.component.component)?.fallthroughTag === "svg";
  const attributes: string[] = [];
  const listeners: string[] = [];
  for (const entry of passed) {
    switch (entry.kind) {
      case "Static": {
        const { name, value } = entry.attribute;
        attributes.push(`${recordKey(name)}: ${JSON.stringify(value === true ? "" : value)}`);
        break;
      }
      case "Bound": {
        const { name } = entry.attribute;
        const value =
          !svg && BINDABLE_BOOLEAN_ATTRIBUTES.has(name)
            ? `${test(entry.code)} ? "" : null`
            : entry.code;
        attributes.push(`${recordKey(name)}: ${value}`);
        break;
      }
      case "Event": {
        const { attribute, statement } = entry.event;
        if (statement === undefined) {
          throw new Error(`The \`${attribute.event}\` listener has no template statement.`);
        }
        const parameter = statement.includes("$event") ? "$event" : "";
        listeners.push(`${recordKey(attribute.event)}: (${parameter}) => ${statement}`);
        break;
      }
      default:
        unreachable(entry);
    }
  }
  const printed: PrintedAttribute[] = [];
  const record = (input: string, entries: string[], consumer: string) => {
    if (!entries.length) return;
    // The consumer's attributes win over the component's own; the own listeners' methods run
    // the consumer's after them.
    const all = !forwards
      ? entries
      : input === ATTRIBUTES_INPUT
        ? [...entries, `...${consumer}`]
        : [`...${consumer}`, ...entries];
    printed.push({
      name: `[${input}]`,
      text: `[${input}]="${angularCode(`{ ${all.join(", ")} }`, "attribute")}"`,
    });
  };
  record(ATTRIBUTES_INPUT, attributes, CONSUMER_ATTRIBUTES);
  record(LISTENERS_INPUT, listeners, CONSUMER_LISTENERS);
  return printed;
}

/**
 * An attribute the element that takes the consumer's binds itself, merged as Vue merges `$attrs`
 * on each render (ADR-0118): the consumer's value where its record has the name, even a nullish
 * one, which removes the attribute, and the element's own otherwise,
 * `[attr.type]="'type' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['type'] : kind"`.
 * The record holds a boolean attribute's value as `[attr.name]` binds it already
 * (`fallthroughRecords`), so only the element's own is tested.
 */
function consumerFirst(
  name: string,
  code: string,
  { namespace }: Parameters<MarkupDialect["boundAttribute"]>[2],
): string {
  const own =
    namespace === "html" && BINDABLE_BOOLEAN_ATTRIBUTES.has(name)
      ? `${test(code)} ? "" : null`
      : code;
  const key = JSON.stringify(name);
  const merged = `${key} in (${CONSUMER_ATTRIBUTES} ?? {}) ? ${CONSUMER_ATTRIBUTES}?.[${key}] : ${own}`;
  return `[attr.${name}]="${angularCode(merged, "attribute")}"`;
}

/** A record's key: the name itself where it is an identifier, quoted otherwise. */
function recordKey(name: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
}

/**
 * The bindings the template reads through a variable or as members, and those lists' keys read
 * from the class. A spread whose type declares no key prints nothing, so its object is no read
 * either. The listeners' template statements count too.
 */
export function templateReads(plan: Plan, listeners: Listeners): TemplateReads {
  const signals = new Set<Expression>();
  const slots = new Set<string>();
  const { component } = plan;
  const unprinted = new Set<Expression>();
  walk(component.render, {
    enter(node) {
      if (node.kind === "SlotOutlet" && (node.slot !== "default" || node.props)) {
        slots.add(node.slot);
      }
      if (node.kind !== "Element" && node.kind !== "Component" && node.kind !== "Dynamic") return;
      // A forwarded named slot tests the parent's own template, through its query.
      for (const fill of node.kind === "Element" ? [] : (node.fills ?? [])) {
        if (fill.forward !== undefined && fill.forward !== "default") slots.add(fill.forward);
      }
      for (const attribute of node.attributes) {
        if (attribute.kind === "Spread" && attribute.keys.length === 0) {
          unprinted.add(attribute.value);
        }
        // A `v-model` reads and writes the state's signal (`this.name`), not its value.
        if (attribute.kind === "Model" || attribute.kind === "ModelBinding") {
          signals.add(attribute.value);
        }
      }
    },
  });
  const read = new Set<BindingId>(listeners.reads);
  const keyed = new Set<BindingId>();
  const globals = new Set<string>(listeners.globals);
  for (const { expression, path } of expressionsOf(component)) {
    // A model's default is the class's (`model(0)`), not the template's.
    if (unprinted.has(expression) || path.startsWith("/setup/")) continue;
    const key = path.endsWith("/key") || signals.has(expression);
    for (const reference of expression.refs) {
      switch (reference.kind) {
        case "Binding":
          // A component `<component is>` names is read as its name, from no member.
          if (bindingById(plan, reference.binding).kind === "component") break;
          (key ? keyed : read).add(reference.binding);
          break;
        case "Global":
          // `undefined` is a keyword of Angular's expression language and needs no member.
          if (reference.name !== "undefined") globals.add(reference.name);
          break;
        // A template reads a recipe through the member the plan gives it (`recipes`).
        case "Import":
          break;
        case "Slot":
          slots.add(reference.slot);
          break;
        default:
          unreachable(reference);
      }
    }
  }
  return { read, keyed, globals: [...globals].toSorted(), slots, signals };
}

/** A string literal in a bound attribute's expression: single-quoted, its quotes escaped. */
function angularString(value: string): string {
  const quoted = value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `'${quoted.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}'`;
}
