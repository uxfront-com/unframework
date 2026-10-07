// An Angular component's template (plan §6, ADR-0035): the markup printed by the Angular dialect,
// read through one `@let` per signal it uses (an input, a state, a derived value, a setup-once
// constant), with its listeners written as template statements (./listeners.ts).
import { angularDialect, printMarkup } from "@unframework/codegen";
import { expressionsOf, walk } from "@unframework/ir";
import type { BindingId, Expression } from "@unframework/ir";

import type { Listeners } from "./listeners.ts";
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
export function template(plan: Plan, listeners: Listeners, reads: TemplateReads): string {
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
  const markup = printMarkup(component.render, angularDialect, {
    indent: INDENT,
    level: LEVEL,
    component,
    rewrite: templateRules(plan),
    handler: (attribute) => listeners.statements.get(attribute),
    attribute: (attribute) =>
      attribute.kind === "Event" ? listeners.attributes.get(attribute) : undefined,
  });
  return [...lets, markup].join("\n");
}

/**
 * The bindings the template reads through a variable or as members, and those lists' keys read
 * from the class. A spread whose type declares no key prints nothing, so its object is no read
 * either. The listeners' template statements count too.
 */
export function templateReads(plan: Plan, listeners: Listeners): TemplateReads {
  const { component } = plan;
  const unprinted = new Set<Expression>();
  walk(component.render, {
    enter(node) {
      if (node.kind !== "Element") return;
      for (const attribute of node.attributes) {
        if (attribute.kind === "Spread" && attribute.keys.length === 0) {
          unprinted.add(attribute.value);
        }
      }
    },
  });
  const read = new Set<BindingId>(listeners.reads);
  const keyed = new Set<BindingId>();
  const globals = new Set<string>(listeners.globals);
  for (const { expression, path } of expressionsOf(component)) {
    const key = path.endsWith("/key");
    if (unprinted.has(expression)) continue;
    for (const reference of expression.refs) {
      switch (reference.kind) {
        case "Binding":
          (key ? keyed : read).add(reference.binding);
          break;
        case "Global":
          // `undefined` is a keyword of Angular's expression language and needs no member.
          if (reference.name !== "undefined") globals.add(reference.name);
          break;
        default:
          unreachable(reference);
      }
    }
  }
  return { read, keyed, globals: [...globals].toSorted() };
}
