// The component's markup: the Astro dialect (`astroDialect`, ADR-0026), the attributes Astro's
// own types do not declare, which `astro check` (L4) would reject as written, and composition in
// Astro's shape (`./composition.ts`): render props, fallthrough, models and `<component is>`.
import {
  astroDialect,
  isIdentifier,
  operand,
  printMarkup,
  rewriteExpression,
} from "@unframework/codegen";
import type {
  MarkupDialect,
  MarkupOptions,
  MarkupPiece,
  PrintedAttribute,
  RewriteRules,
} from "@unframework/codegen";
import type {
  Attribute,
  ComponentAttribute,
  ElementNode,
  FragmentNode,
  SlotFill,
  UfComponent,
} from "@unframework/ir";

import { isRenderProp, SPREAD_STYLE } from "./composition.ts";
import type { AstroRender } from "./composition.ts";
import { unreachable } from "./spelling.ts";
import type { Spelling } from "./spelling.ts";

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

/** What a component's markup needs beyond the dialect: its spelling and its Astro render tree. */
export interface ComposedMarkup {
  spelling: Spelling;
  render: AstroRender;
  /** The tag each child is written with, where it is not its local name (`Astro.self`). */
  tags: ReadonlyMap<string, string>;
}

/**
 * A component's markup, with references spelled by `rewrite`, as the frontmatter declares them
 * (`count.value` is `count`), or as written without it. Listeners and template refs print
 * nothing: the dialect is inert. With `composed`, the tree is its Astro copy and the dialect
 * writes composition as `./composition.ts` shapes it.
 */
export function printComponentMarkup(
  component: UfComponent,
  rewrite?: RewriteRules,
  composed?: ComposedMarkup,
): string {
  if (!composed) {
    return printMarkup(component.render, dialect, { component, ...(rewrite ? { rewrite } : {}) });
  }
  const options: MarkupOptions = {
    component,
    rewrite: composed.spelling.rules,
    componentTag: (name) => composed.tags.get(name),
  };
  const composedDialect = composition(component, composed, options);
  return printMarkup(composed.render.render, composedDialect, options);
}

/** The dialect, with what composition needs of the component and its spelling. */
function composition(
  component: UfComponent,
  { spelling, render }: ComposedMarkup,
  options: MarkupOptions,
): MarkupDialect {
  const code = (expression: Parameters<typeof rewriteExpression>[0]) =>
    rewriteExpression(expression, component, spelling.rules);
  /** A control's own value as code: its `value`, or the `"on"` a checkbox or radio has without one. */
  const controlValue = (element: ElementNode): string => {
    for (const attribute of element.attributes) {
      if (attribute.kind === "Static" && attribute.name === "value" && attribute.value !== true) {
        return JSON.stringify(attribute.value);
      }
      if (attribute.kind === "Bound" && attribute.name === "value") return code(attribute.value);
    }
    return JSON.stringify("on");
  };
  const composed: MarkupDialect = {
    ...dialect,
    // A scoped fill is a render prop named as the slot, the forwarded one the component's own.
    propAttribute(prop, context) {
      const fill = context.component.fills.find(
        (each) => render.renderProps.get(each) === prop.name,
      );
      if (!fill) return dialect.propAttribute!(prop, context);
      const value =
        fill.forward === undefined ? renderFunction(fill) : spelling.renderProps.get(fill.forward)!;
      return [{ name: prop.name, text: `${prop.name}={${value}}` }];
    },
    fills: (fills, context) =>
      dialect.fills!(
        fills.filter(({ fill }) => !isRenderProp(fill, component)),
        context,
      ),
    slotOutlet: (outlet) =>
      dialect.slotOutlet!(
        outlet.props
          ? {
              ...outlet,
              node: { ...outlet.node, slot: spelling.renderProps.get(outlet.node.slot)! },
            }
          : outlet,
      ),
    /**
     * A control's model as the state it renders with (ADR-0054): a text field's `value`, a
     * checkbox's or a radio's `checked`. A `<textarea>`'s text and a `<select>`'s options are
     * written into the tree (`./composition.ts`).
     */
    modelAttribute({ attribute, value }, { element }): PrintedAttribute[] {
      switch (attribute.control) {
        case "text":
        case "number":
          return [{ name: "value", text: `value={${value}}` }];
        case "checkbox":
          return [{ name: "checked", text: `checked={${value}}` }];
        case "checkbox-group":
          return [
            {
              name: "checked",
              text: `checked={${operand(value)}.includes(${controlValue(element)})}`,
            },
          ];
        case "radio":
          return [{ name: "checked", text: `checked={${value} === ${controlValue(element)}}` }];
        case "textarea":
        case "select":
        case "select-multiple":
          return [];
        default:
          return unreachable(attribute.control);
      }
    },
    /**
     * `<component is>` as the constant it renders (`const Tag = …`), a tag: the frontmatter's,
     * or one declared in place, in a function the expression calls at once, where the list's,
     * the branch's or the fill's bindings and guards hold (`DynamicTag`).
     */
    dynamic({ node, is }) {
      const { name, hoisted } = render.dynamics.get(node)!;
      const piece: MarkupPiece = node.candidates.every((candidate) => candidate.kind === "Tag")
        ? {
            kind: "element",
            element: {
              kind: "Element",
              tag: name,
              attributes: node.attributes as Attribute[],
              children: node.children,
              span: node.span,
            },
            directives: [],
          }
        : {
            kind: "component",
            component: {
              kind: "Component",
              component: name,
              attributes: node.attributes as ComponentAttribute[],
              fills: node.fills ?? [],
              span: node.span,
            },
            directives: [],
          };
      if (hoisted) return [piece];
      return [
        {
          kind: "block",
          segments: [
            { open: `{(() => { const ${name} = ${is}; return `, content: piece, parentheses: true },
          ],
          close: "; })()}",
        },
      ];
    },
    /**
     * A style as an object where a component takes it, so that the child can spread it after its
     * own declarations, and on the root, which spreads the consumer's (`SPREAD_STYLE`).
     */
    styleAttribute(parts, context) {
      const consumer = parts.find((part) => part.property === SPREAD_STYLE);
      if (!consumer && !/^[A-Z]|\./.test(context.element.tag)) {
        return dialect.styleAttribute(parts, context);
      }
      const own = parts.filter((part) => part !== consumer);
      if (!own.length) return [{ name: "style", text: `style={${consumer!.value}}` }];
      // The dialect writes an object whenever a declaration is bound: a static value is the
      // same string literal there.
      const [object] = dialect.styleAttribute(
        own.map((part) =>
          part.kind === "Static"
            ? { kind: "Bound", property: part.property, value: JSON.stringify(part.value) }
            : part,
        ),
        context,
      );
      const text = consumer
        ? `${object!.text.slice(0, -3)}, ...${consumer.value} }}`
        : object!.text;
      return [{ name: "style", text }];
    },
  };

  /**
   * A scoped fill as the function the child calls (ADR-0054): its parameter as written, and its
   * content as Astro markup: one element, a string, or a fragment.
   */
  function renderFunction(fill: SlotFill): string {
    const parameter = fill.parameter?.name ?? fill.parameter?.pattern?.code ?? "";
    const [only, ...more] = fill.children;
    if (more.length === 0 && only?.kind === "Text")
      return `(${parameter}) => ${JSON.stringify(only.value)}`;
    const root: FragmentNode = { kind: "Fragment", children: fill.children, span: fill.span };
    const single = more.length === 0 && (only?.kind === "Element" || only?.kind === "Component");
    const body = printMarkup(root, composed, options);
    const markup = single ? body : `<>\n${indented(body)}\n</>`;
    const value = markup.includes("\n") ? `(\n${indented(markup)}\n)` : markup;
    return `(${parameter}) => ${value}`;
  }
  return composed;
}

const indented = (text: string): string =>
  text
    .split("\n")
    .map((line) => (line ? `  ${line}` : line))
    .join("\n");
