// An Angular component's template (design §5.5): the markup printed by the Angular dialect, read
// through one `@let` per input it uses.
import { angularDialect, printMarkup } from "@unframework/codegen";
import type { RewriteRules } from "@unframework/codegen";
import { expressionsOf, walk } from "@unframework/ir";
import type { BindingId, Expression, Reference, UfComponent } from "@unframework/ir";

/** The template's indentation: two levels, inside the decorator's object. */
const INDENT = "  ";
const LEVEL = 2;

/**
 * The component's template: the `@let` declarations that read the inputs it uses, each once,
 * then its markup. Angular drops whitespace at the template's edges and between a `@let` and
 * what follows it, so each can sit on a line of its own.
 *
 * Why `@let`: Angular's type checker narrows a template variable as TypeScript narrows a local
 * (`@if (phone) { {{ phone.length }} }`, `item && item.name`, `items[0] && items[0].id`), but
 * never a signal call, which it reads again each time (TS2532 on `phone() && phone().length`).
 * Through a variable, every expression the source wrote type-checks in the template as it does
 * in the source (L4). `this.label()` reads the input: the variable takes the prop's name, and a
 * name in a template means a template variable before a member.
 *
 * A `track` expression may read only its own item, `$index` and the component's members
 * (NG8009), so a prop a list's key reads is read there from its input, `this.label()`, and
 * counts as no use of its variable (an unread `@let` is NG8112).
 */
export function template(component: UfComponent): string {
  const { read, keyReferences } = templateReads(component);
  const rules: RewriteRules = {
    // In the object form too: `props.label` → `label`. The analyser keeps every prop name a
    // valid template name (no Angular keyword, no `$`, ADR-0034) and rejects a loop or arrow
    // parameter that would capture one (UF3024). A loop variable is the `@for`'s own.
    binding: (reference, binding) =>
      binding.kind === "prop" && keyReferences.has(reference)
        ? `this.${binding.name}()`
        : binding.name,
  };
  const pad = INDENT.repeat(LEVEL);
  const reads = component.props.flatMap(({ name, binding }) =>
    binding !== undefined && read.has(binding) ? [`${pad}@let ${name} = this.${name}();`] : [],
  );
  const markup = printMarkup(component.render, angularDialect, {
    indent: INDENT,
    level: LEVEL,
    component,
    rewrite: rules,
  });
  return [...reads, markup].join("\n");
}

/**
 * The bindings the template reads through a variable, and the references in lists' keys, which
 * read the inputs instead. A spread whose type declares no key prints nothing, so its object is
 * no read either.
 */
function templateReads(component: UfComponent): {
  read: Set<BindingId>;
  keyReferences: Set<Reference>;
} {
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
  const read = new Set<BindingId>();
  const keyReferences = new Set<Reference>();
  for (const { expression, path } of expressionsOf(component)) {
    const key = path.endsWith("/key");
    if (unprinted.has(expression)) continue;
    for (const reference of expression.refs) {
      if (key) keyReferences.add(reference);
      else if (reference.kind === "Binding") read.add(reference.binding);
    }
  }
  return { read, keyReferences };
}
