// Composition in Astro's shape (ADR-0054): what the markup printer cannot write from the IR as it
// stands, because Astro writes it elsewhere than the source. The render tree is copied with:
// - the consumer's `class` and `style` merged into the root (fallthrough), read from the props;
// - each scoped fill, and each forwarded scoped slot, as a render prop named as the slot, since
//   Astro's `<Fragment slot>` drops a slot's arguments; the fill stays in place, for what reads
//   its bindings (a list's index), and the dialect writes no content for it;
// - a `<textarea>`'s model as its text, and a `<select>`'s as `selected` on its options.
// Astro renders once, on the server, so a model renders its initial state and nothing writes it.
import { rewriteExpression, spreadStyleExpression } from "@unframework/codegen";
import type {
  Attribute,
  ComponentAttribute,
  ComponentNode,
  DynamicNode,
  ElementNode,
  Expression,
  FragmentNode,
  IfNode,
  ModelAttribute,
  PropAttribute,
  RenderNode,
  SlotFill,
  UfComponent,
  UfModule,
} from "@unframework/ir";

import { renderPropName, unreachable } from "./spelling.ts";
import type { Spelling } from "./spelling.ts";

/**
 * The property of the style declaration that stands for the consumer's style, spread last into
 * the root's style object so that its declarations win (`...style`).
 */
export const SPREAD_STYLE = "...";

/** The names the frontmatter reads the consumer's `class` and `style` under. */
export interface Fallthrough {
  className: string;
  style: string;
}

/** A component's render tree in Astro's shape, with the names the frontmatter declares for it. */
export interface AstroRender {
  render: ElementNode | FragmentNode;
  /** Present where the root takes the consumer's `class` and `style` (ADR-0054). */
  fallthrough?: Fallthrough;
  /** Each `<component is>` of the copy, with the constant it is declared as. */
  dynamics: Map<DynamicNode, DynamicTag>;
  /**
   * The props each fill the copy passes as a render prop is passed as (`renderPropName`): one,
   * or one per name the candidates of a `<component is>` give it.
   */
  renderProps: Map<SlotFill, string[]>;
}

/**
 * The constant `<component is>` renders as (`const Tag = …`): hoisted into the frontmatter where
 * the expression reads only what the whole render has, or else declared in place, inside a
 * list's callback, a branch or a fill, where its bindings are in scope and its guards hold.
 */
export interface DynamicTag {
  name: string;
  hoisted: boolean;
  /**
   * The attributes of each candidate, by its local name, where the candidates name a fill's
   * render prop apart: the tag then renders as each candidate in turn (`Tag === A ? <A … /> :
   * …`), so a candidate never takes another's name for a render prop, which can be its prop.
   */
  candidates?: Map<string, ComponentAttribute[]>;
}

/**
 * Whether a component's root takes a consumer's `class` and `style`: one element, or one
 * component, unless `inheritAttrs` is off (the analyser's `ComponentApi.root`).
 */
export function takesFallthrough(component: UfComponent): boolean {
  if (component.inheritAttrs === false) return false;
  const { render } = component;
  return (
    render.kind === "Element" ||
    (render.children.length === 1 && render.children[0]!.kind === "Component")
  );
}

/**
 * Whether a fill is passed as a render prop: a scoped one, or a forwarded slot that takes props
 * (`slots` are the component's own declared slots).
 */
export function isRenderProp(fill: SlotFill, component: UfComponent): boolean {
  if (fill.parameter !== undefined) return true;
  if (fill.forward === undefined) return false;
  return component.slots?.slots.find((slot) => slot.name === fill.forward)?.props !== undefined;
}

/** The names a component's props and models take, which its render props keep apart from. */
export function ownProps(component: UfComponent): Set<string> {
  return new Set([
    ...component.props.map((prop) => prop.name),
    ...component.setup.flatMap((item) => (item.kind === "Model" ? [item.name] : [])),
  ]);
}

/**
 * The props and models of a component a template renders, by its local name, from its API: one
 * of the module's own, or an imported one's, as the resolver gave it (ADR-0053).
 */
function childProps(module: UfModule, local: string): Set<string> {
  for (const entry of module.imports ?? []) {
    const imported = entry.names.find((name) => name.kind === "Component" && name.local === local);
    if (!imported) continue;
    const api = entry.api.components.find((each) =>
      imported.imported === "default"
        ? each.export === "default"
        : each.export === "named" && each.name === imported.imported,
    );
    return new Set([...(api?.props ?? []), ...(api?.models ?? [])].map(({ name }) => name));
  }
  const own = module.components.find((each) => each.name === local);
  return own ? ownProps(own) : new Set();
}

/** A component's render tree in Astro's shape. */
export function astroRender(
  component: UfComponent,
  module: UfModule,
  spelling: Spelling,
  fallthrough: Fallthrough | undefined,
): AstroRender {
  const rules = spelling.rules;
  const dynamics = new Map<DynamicNode, DynamicTag>();
  // How many lists, branches and fills the node being copied sits in.
  let depth = 0;
  const nested = <T>(copy: () => T): T => {
    depth++;
    try {
      return copy();
    } finally {
      depth--;
    }
  };
  const code = (expression: Expression) => rewriteExpression(expression, component, rules);

  // A root component takes the fallthrough before it branches (`withFallthrough`).
  const rootComponent =
    component.render.kind === "Fragment" ? component.render.children[0] : undefined;
  const nodes = (children: readonly RenderNode[]): RenderNode[] => children.map(node);
  const fills = (each: readonly SlotFill[]): SlotFill[] =>
    each.map((fill) => ({ ...fill, children: nested(() => nodes(fill.children)) }));
  const renderPropNames = new Map<SlotFill, string[]>();
  // The render props of a component's fills, named as the child names them (`taken`: its props).
  const renderProps = (each: readonly SlotFill[], taken: ReadonlySet<string>): PropAttribute[] =>
    each
      .filter((fill) => isRenderProp(fill, component))
      .map((fill) => {
        const name = renderPropName(fill.slot, taken);
        renderPropNames.set(fill, [...new Set([...(renderPropNames.get(fill) ?? []), name])]);
        // The dialect writes the fill's function in its place (`../markup.ts`).
        return { kind: "Prop", name, value: written("undefined", fill), span: fill.span };
      });

  function node(each: RenderNode): RenderNode {
    switch (each.kind) {
      case "Text":
      case "Interpolation":
        return each;
      case "Element":
        return element(each);
      case "If":
        return {
          ...each,
          branches: each.branches.map((branch) => ({
            ...branch,
            children: nested(() => nodes(branch.children)),
          })),
        };
      case "For":
        // A body that forwards slots is a conditional, which the dialect writes in the callback.
        return {
          ...each,
          body: nested(() =>
            each.body.kind === "Element" ? element(each.body) : branched(componentChild(each.body)),
          ) as ElementNode | ComponentNode,
        };
      case "Component":
        return branched(componentChild(each));
      case "SlotOutlet":
        return { ...each, fallback: nodes(each.fallback) };
      case "Dynamic": {
        const tag: DynamicTag = { name: spelling.scope.claim("Tag"), hoisted: depth === 0 };
        const copied = each.fills ? fills(each.fills) : undefined;
        // Each candidate names a render prop apart from its own props (`renderPropName`).
        const named = new Map(
          each.candidates.flatMap((candidate) =>
            candidate.kind === "Component"
              ? [
                  [
                    candidate.component,
                    renderProps(copied ?? [], childProps(module, candidate.component)),
                  ] as const,
                ]
              : [],
          ),
        );
        const [first = [], ...others] = [...named.values()];
        const apart = others.some((props) =>
          props.some((prop, at) => prop.name !== first[at]!.name),
        );
        if (apart) {
          tag.candidates = new Map(
            [...named].map(([candidate, props]) => [
              candidate,
              [...(each.attributes as ComponentAttribute[]), ...props],
            ]),
          );
        }
        const copy = branched({
          ...each,
          attributes: [...each.attributes, ...first],
          children: nodes(each.children),
          ...(copied ? { fills: copied } : {}),
        });
        // Each branch renders the same constant.
        const copies =
          copy.kind === "If" ? copy.branches.map((branch) => branch.children[0]!) : [copy];
        for (const dynamic of copies) dynamics.set(dynamic as DynamicNode, tag);
        return copy;
      }
      default:
        return unreachable(each);
    }
  }

  function componentChild(each: ComponentNode): ComponentNode {
    const root = each === rootComponent && fallthrough ? withFallthrough(each, fallthrough) : each;
    const copied = fills(root.fills);
    return {
      ...root,
      attributes: [...root.attributes, ...renderProps(copied, childProps(module, root.component))],
      fills: copied,
    };
  }

  /**
   * A component that forwards slots, as one branch per set of the forwarded slots present, the
   * largest first, each with only those fills: Astro's compiler gives a component every slot its
   * content names, so a fill kept where the slot is absent would hide the child's fallback.
   * Each branch tests only the slots it forwards: the branches before it, which test larger
   * sets, failed.
   */
  function branched<T extends ComponentNode | DynamicNode>(each: T): T | IfNode {
    const forwarded = (each.fills ?? []).filter(
      (fill) => fill.forward !== undefined && !isRenderProp(fill, component),
    );
    if (!forwarded.length) return each;
    const sets = forwarded
      .reduce<SlotFill[][]>((all, fill) => all.flatMap((set) => [[...set, fill], set]), [[]])
      .toSorted((a, b) => b.length - a.length);
    const presence = (fill: SlotFill) =>
      rules.slot!({ kind: "Slot", slot: fill.forward!, span: fill.span }, "render");
    return {
      kind: "If",
      branches: sets.map((set) => ({
        ...(set.length ? { condition: written(set.map(presence).join(" && "), each) } : {}),
        children: [
          {
            ...each,
            fills: (each.fills ?? []).filter(
              (fill) => !forwarded.includes(fill) || set.includes(fill),
            ),
          },
        ],
        span: each.span,
      })),
      span: each.span,
    };
  }

  function element(each: ElementNode): ElementNode {
    const model = each.attributes.find(
      (attribute): attribute is ModelAttribute => attribute.kind === "Model",
    );
    if (model?.control === "textarea") {
      return {
        ...each,
        children: [{ kind: "Interpolation", value: model.value, span: model.span }],
      };
    }
    if (model?.control === "select" || model?.control === "select-multiple") {
      const value = code(model.value);
      const test = (option: string) =>
        model.control === "select" ? `${value} === ${option}` : `${value}.includes(${option})`;
      return { ...each, children: each.children.map((child) => selected(child, test)) };
    }
    return { ...each, children: nodes(each.children) };
  }

  /** An option of a bound `<select>`, selected where its value is the model's (ADR-0054). */
  function selected(each: RenderNode, test: (option: string) => string): RenderNode {
    if (each.kind === "Element" && each.tag === "option") {
      const option = optionValue(each, code);
      const attribute: Attribute = {
        kind: "Bound",
        name: "selected",
        value: written(test(option), each),
        span: each.span,
      };
      return { ...each, attributes: [...each.attributes, attribute] };
    }
    if (each.kind === "Element") {
      return { ...each, children: each.children.map((child) => selected(child, test)) };
    }
    if (each.kind === "If") {
      return {
        ...each,
        branches: each.branches.map((branch) => ({
          ...branch,
          children: branch.children.map((child) => selected(child, test)),
        })),
      };
    }
    if (each.kind === "For") return { ...each, body: selected(each.body, test) as ElementNode };
    return node(each);
  }

  const render =
    component.render.kind === "Element"
      ? element(component.render)
      : { ...component.render, children: nodes(component.render.children) };
  if (!fallthrough) return { render, dynamics, renderProps: renderPropNames };
  return {
    render: render.kind === "Element" ? withFallthrough(render, fallthrough) : render,
    fallthrough,
    dynamics,
    renderProps: renderPropNames,
  };
}

/**
 * The root with the consumer's `class` merged into its own, and the consumer's `style` spread
 * after its own declarations: Astro passes a component's `class` (`class:list` resolved) and
 * `style` as props.
 */
function withFallthrough<T extends ElementNode | ComponentNode>(root: T, names: Fallthrough): T {
  const attributes = [...root.attributes] as (Attribute | ComponentAttribute)[];
  const className = {
    kind: "Dynamic" as const,
    value: written(names.className, root),
    span: root.span,
  };
  const style = {
    kind: "Bound" as const,
    property: SPREAD_STYLE,
    value: written(names.style, root),
    span: root.span,
  };
  // A static `class` is one of the root's attributes: it joins the class as a static part.
  const staticAt = attributes.findIndex(
    (attribute) => attribute.kind === "Static" && attribute.name === "class",
  );
  const own = attributes[staticAt];
  if (own?.kind === "Static" && own.value !== true) {
    attributes[staticAt] = {
      kind: "Class",
      items: [{ kind: "Static", value: own.value, span: own.span }],
      span: own.span,
    };
  }
  const classAt = attributes.findIndex((attribute) => attribute.kind === "Class");
  const existing = attributes[classAt];
  if (existing?.kind === "Class")
    attributes[classAt] = { ...existing, items: [...existing.items, className] };
  else attributes.push({ kind: "Class", items: [className], span: root.span });
  const styleAt = attributes.findIndex((attribute) => attribute.kind === "Style");
  const declared = attributes[styleAt];
  // A style bound to one value, or a spread's `style` key, is the root's own (ADR-0065).
  const spreadAt = attributes.findIndex(
    (attribute) =>
      attribute.kind === "Spread" && attribute.keys.some((key) => key.name === "style"),
  );
  const spread = attributes[spreadAt];
  if (spread?.kind === "Spread") {
    const whole = {
      kind: "Bound" as const,
      property: "",
      value: spreadStyleExpression(spread),
      span: spread.span,
    };
    attributes[spreadAt] = { ...spread, keys: spread.keys.filter((key) => key.name !== "style") };
    attributes.push({ kind: "Style", declarations: [whole, style], span: root.span });
  } else if (declared?.kind === "Style" && declared.value) {
    const whole = {
      kind: "Bound" as const,
      property: "",
      value: declared.value,
      span: declared.span,
    };
    attributes[styleAt] = { kind: "Style", declarations: [whole, style], span: declared.span };
  } else if (declared?.kind === "Style") {
    attributes[styleAt] = { ...declared, declarations: [...declared.declarations, style] };
  } else attributes.push({ kind: "Style", declarations: [style], span: root.span });
  return { ...root, attributes } as T;
}

/**
 * An option's value as code: its `value` attribute, or its text, which a form submits where it
 * has none.
 */
function optionValue(option: ElementNode, code: (expression: Expression) => string): string {
  for (const attribute of option.attributes) {
    if (attribute.kind === "Static" && attribute.name === "value" && attribute.value !== true) {
      return JSON.stringify(attribute.value);
    }
    if (attribute.kind === "Bound" && attribute.name === "value") return code(attribute.value);
  }
  const text = option.children.map((child) => (child.kind === "Text" ? child.value : "")).join("");
  return JSON.stringify(text.trim().replace(/\s+/g, " "));
}

/**
 * Code the target writes itself, already in the output's spelling: no references, so the
 * printer splices nothing into it.
 */
function written(code: string, at: { span: Expression["span"] }): Expression {
  return { code, span: at.span, refs: [] };
}
