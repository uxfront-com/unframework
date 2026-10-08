// The component's markup: the Astro dialect (`astroDialect`, ADR-0026), and the attributes
// Astro's own types do not declare, which `astro check` (L4) would reject as written.
import { astroDialect, isIdentifier, printMarkup } from "@unframework/codegen";
import type { MarkupDialect, RewriteRules } from "@unframework/codegen";
import type { UfComponent } from "@unframework/ir";

/**
 * The HTML attributes the analyser accepts that Astro's JSX types (`astro/astro-jsx.d.ts`, 7.3)
 * declare on some elements only, with those elements: `autocorrect`, a global attribute, is
 * declared on form controls alone. `test/attributes.test.ts` pins this table against
 * `astro check` over every pair the analyser accepts, both ways.
 */
const PARTLY_TYPED_ATTRIBUTES: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["autocorrect", new Set(["form", "input", "select", "textarea"])],
]);

/** Whether Astro's types reject `name` on an HTML `tag`. */
export function isUntypedAttribute(tag: string, name: string): boolean {
  const typedOn = PARTLY_TYPED_ATTRIBUTES.get(name);
  return typedOn !== undefined && !typedOn.has(tag);
}

/**
 * An attribute as an object spread (`{...{ autocorrect: "off" }}`): Astro renders each key as it
 * renders the attribute, and TypeScript checks a spread's keys only against the ones the
 * element declares, so the attribute keeps its value and passes `astro check`.
 */
function spread(name: string, code: string): string {
  return `{...{ ${isIdentifier(name) ? name : JSON.stringify(name)}: ${code} }}`;
}

/** The Astro dialect, with the attributes Astro's types lack written as spreads. */
const dialect: MarkupDialect = {
  ...astroDialect,
  attribute: (name, value, tag) =>
    isUntypedAttribute(tag, name)
      ? spread(name, JSON.stringify(value))
      : astroDialect.attribute(name, value, tag),
  boundAttribute(name, code, context) {
    const printed = astroDialect.boundAttribute(name, code, context);
    if (context.namespace !== "html" || !isUntypedAttribute(context.element.tag, name)) {
      return printed;
    }
    // The dialect writes `name={value}`: the same value goes into the spread.
    return spread(name, printed.slice(name.length + 2, -1));
  },
};

/**
 * A component's markup, with references spelled by `rewrite`, as the frontmatter declares them
 * (`count.value` is `count`), or as written without it. Listeners and template refs print
 * nothing: the dialect is inert.
 */
export function printComponentMarkup(component: UfComponent, rewrite?: RewriteRules): string {
  return printMarkup(component.render, dialect, { component, ...(rewrite ? { rewrite } : {}) });
}
