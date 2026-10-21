// An Angular component's template (plan §6, ADR-0035): the markup printed by the Angular dialect,
// read through one `@let` per signal it uses (an input, a state, a derived value, a setup-once
// constant), with its listeners written as template statements (./listeners.ts).
import { angularCode, angularDialect, printMarkup } from "@unframework/codegen";
import type { MarkupDialect } from "@unframework/codegen";
import { expressionsOf, walk } from "@unframework/ir";
import type {
  Attribute,
  BindingId,
  ClassItem,
  ComponentAttribute,
  ComponentNode,
  ElementNode,
  Expression,
  FragmentNode,
  StyleDeclaration,
} from "@unframework/ir";

import { selectorOf } from "./composition.ts";
import type { Composition } from "./composition.ts";
import type { Listeners } from "./listeners.ts";
import type { Models } from "./models.ts";
import { outputName } from "./outputs.ts";
import { bindingById, unreachable } from "./plan.ts";
import type { Plan } from "./plan.ts";
import { readThroughLet, templateRules } from "./rules.ts";

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
  fallthrough: boolean,
): string {
  const { component } = plan;
  const pad = INDENT.repeat(LEVEL);
  const lets: string[] = [];
  const declare = (id: BindingId | undefined) => {
    if (id === undefined || !reads.read.has(id)) return;
    const binding = bindingById(plan, id);
    if (readThroughLet(plan, binding)) {
      lets.push(`${pad}@let ${binding.name} = this.${binding.name}();`);
    }
  };
  for (const prop of component.props) declare(prop.binding);
  for (const item of component.setup) {
    if ("binding" in item) declare(item.binding);
  }
  const dialect: MarkupDialect = {
    ...angularDialect,
    componentTag: (name) => composition.tags.get(name) ?? selectorOf(name),
    // A child's output's listener runs the statement ./listeners.ts plans for it.
    componentEvent: ({ attribute }) => {
      const name = `(${outputName(attribute.event)})`;
      const statement = listeners.outputs.get(attribute)!;
      return [{ name, text: `${name}="${angularCode(statement, "event")}"` }];
    },
    modelAttribute: ({ attribute }) => models.attributes.get(attribute)!,
  };
  const render = fallthrough ? withFallthrough(models.render) : models.render;
  const markup = printMarkup(render, dialect, {
    indent: INDENT,
    level: LEVEL,
    component,
    rewrite: templateRules(plan, reads.signals),
    handler: (attribute) => listeners.statements.get(attribute),
    attribute: (attribute) =>
      attribute.kind === "Event"
        ? listeners.attributes.get(attribute)
        : models.options.get(attribute),
  });
  // A slot's templates are projected here, so none counts as the default slot's content
  // (ADR-0056); an `<ng-template>` renders nothing where it is projected.
  const selects = composition.slots.map(
    ({ attribute }) => `${pad}<ng-content select="[${attribute}]" />`,
  );
  return [...lets, markup, ...selects].join("\n");
}

/**
 * The component's root (an element, or a fragment of one element or component), which a
 * consumer's `class` and `style` fall through to (ADR-0054), or none.
 */
export function fallthroughRoot(
  render: ElementNode | FragmentNode,
): ElementNode | ComponentNode | undefined {
  if (render.kind === "Element") return render;
  const [only] = render.children;
  return render.children.length === 1 && (only?.kind === "Element" || only?.kind === "Component")
    ? only
    : undefined;
}

/**
 * The render tree with the consumer's `class` and `style` inputs merged into the root
 * (ADR-0056): `this.class()` among its class's parts, and `this.style()` as its whole style,
 * whose own declarations it overrides as Vue's merge does.
 */
function withFallthrough(render: ElementNode | FragmentNode): ElementNode | FragmentNode {
  const root = fallthroughRoot(render)!;
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
    value: expression("this.style()"),
    span,
  };
  const styleAt = attributes.findIndex((attribute) => attribute.kind === "Style");
  const style = attributes[styleAt];
  if (style?.kind === "Style") {
    attributes[styleAt] = { ...style, declarations: [...style.declarations, declaration] };
  } else attributes.push({ kind: "Style", declarations: [declaration], span });
  const merged = { ...root, attributes } as ElementNode | ComponentNode;
  if (render.kind === "Element") return merged as ElementNode;
  return { ...render, children: [merged] };
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
        // A template reads a pass-through import through a member, as it reads a global.
        case "Import":
          globals.add(reference.name);
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
