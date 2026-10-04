// The component's markup: the Astro dialect (`astroDialect`, design §4.3), and the attributes
// Astro's own types do not declare, which `astro check` (L4) would reject as written.
import { astroDialect, isIdentifier, printMarkup } from "@unframework/codegen";
import type { MarkupDialect, MarkupOptions, RewriteRules } from "@unframework/codegen";
import type { UfComponent } from "@unframework/ir";

/**
 * HTML attributes the analyser accepts that Astro's JSX types (`astro/astro-jsx.d.ts`, 7.3) do
 * not declare on the element, by tag (`*`: on every element that does not declare it either).
 * `test/attributes.test.ts` pins this list against `astro check` over the IR's vocabulary.
 */
const UNTYPED_ATTRIBUTES: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["*", new Set(["autocorrect", "nonce", "writingsuggestions"])],
  ["area", new Set(["ping"])],
  ["form", new Set(["rel"])],
  ["img", new Set(["ismap"])],
]);

/** The elements Astro's types declare `autocorrect` or `nonce` on, which `*` leaves out. */
const TYPED_ON: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["autocorrect", new Set(["form", "input", "textarea", "select"])],
  ["nonce", new Set(["script", "style"])],
]);

/** Whether Astro's types reject `name` on an HTML `tag`. */
export function isUntypedAttribute(tag: string, name: string): boolean {
  if (UNTYPED_ATTRIBUTES.get(tag)?.has(name)) return true;
  return UNTYPED_ATTRIBUTES.get("*")!.has(name) && !TYPED_ON.get(name)?.has(tag);
}

/**
 * An attribute as an object spread (`{...{ ping: url }}`): Astro renders each key as it
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
 * A component's markup, with references spelled by `rewrite` when the frontmatter renames
 * what they read. A bare attribute Astro's types lack (`ismap`) is written `""`, which Astro
 * renders bare as well.
 */
export function printComponentMarkup(component: UfComponent, rewrite?: RewriteRules): string {
  const options: MarkupOptions = {
    component,
    ...(rewrite ? { rewrite } : {}),
    attribute: (attribute, element) =>
      attribute.kind === "Static" &&
      attribute.value === true &&
      isUntypedAttribute(element.tag, attribute.name)
        ? spread(attribute.name, '""')
        : undefined,
  };
  return printMarkup(component.render, dialect, options);
}
