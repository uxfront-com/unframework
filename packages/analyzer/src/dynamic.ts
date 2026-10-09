// `<component is={…}>` over a statically known set (ADR-0054, plan §4.6): `is` is a literal, a
// conditional whose leaves are literals or components, or a value typed as a union of tags (a
// prop's `"h2" | "h3"`). The leaves are all HTML tags, whose attributes and children each tag
// must take, or all components, whose attributes and fills each must declare (UF3044
// otherwise). Each component a leaf names is a `component` binding, which only the `is` reads.

import {
  createBinding,
  createBindingReference,
  createDynamicNode,
  createExpression,
  isHtmlElement,
  isVoidElement,
} from "@unframework/ir";
import type {
  Attribute,
  Reference,
  ComponentAttribute,
  DynamicCandidate,
  DynamicNode,
  SlotFill,
} from "@unframework/ir";
import type { AST } from "@unframework/parser";

import { lowerAttributes } from "./attributes.ts";
import { componentOf, lowerComponentAs } from "./components.ts";
import { Reporter } from "./context.ts";
import { checkPlacement } from "./elements.ts";
import { checkExpression, span } from "./expressions.ts";
import { hasContent, lowerChildren } from "./lower.ts";
import type { Place } from "./lower.ts";
import { CONTROL_MODEL } from "./models.ts";
import type { ComponentInfo, RenderContext } from "./render.ts";
import { has } from "./types/kinds.ts";

/** A leaf of `is`: a tag, or a component by the identifier that names it. */
type Leaf =
  | { kind: "Tag"; tag: string; node: AST.Node }
  | { kind: "Component"; info: ComponentInfo; node: AST.IdentifierReference };

/** Reports `<component is>` that chooses from no statically known set (UF3044). */
function open(render: RenderContext, at: { start: number; end: number }, message: string): void {
  render.reporter.report("UF3044", at, message, {
    help: 'Choose from a known set: `is={href ? "a" : "button"}`, `is={compact ? Chip : Card}`, or a prop typed as a union of tags.',
  });
}

/**
 * Lowers `<component is>` (ADR-0054). Returns the node, or `undefined` when it is reported; its
 * content is still checked.
 */
export function lowerDynamic(
  node: AST.JSXElement,
  name: AST.JSXIdentifier,
  place: Place,
  render: RenderContext,
  listBody: boolean,
): DynamicNode | undefined {
  const { reporter } = render;
  const mark = reporter.diagnostics.length;
  const isAttribute = node.openingElement.attributes.find(
    (item): item is AST.JSXAttribute =>
      item.type === "JSXAttribute" && item.name.type === "JSXIdentifier" && item.name.name === "is",
  );
  if (listBody) {
    reporter.unsupported(
      name,
      "`<component is>` as the element a list renders is not supported: a list renders an element or a component, which takes its `key`.",
      { help: "Wrap it in an element that takes the `key`." },
    );
    return undefined;
  }
  const value = isAttribute?.value;
  const expression =
    value?.type === "Literal"
      ? value
      : value?.type === "JSXExpressionContainer" && value.expression.type !== "JSXEmptyExpression"
        ? value.expression
        : undefined;
  if (!isAttribute || !expression) {
    open(
      render,
      isAttribute ?? name,
      "`<component>` takes `is`, the tag or the component it renders.",
    );
    lowerChildren(node.children, place, render);
    return undefined;
  }
  const refs: Reference[] = [];
  const leaves = leavesOf(expression, render, refs);
  if (!leaves) return undefined;
  const tags = leaves.every((leaf) => leaf.kind === "Tag");
  if (!tags && leaves.some((leaf) => leaf.kind === "Tag")) {
    open(
      render,
      expression,
      "`is` chooses between tags and components: every target renders the two in different ways, so its leaves are all tags or all components.",
    );
    return undefined;
  }
  const candidates: DynamicCandidate[] = [];
  for (const leaf of leaves) {
    const candidate: DynamicCandidate =
      leaf.kind === "Tag"
        ? { kind: "Tag", tag: leaf.tag }
        : { kind: "Component", component: leaf.info.name };
    if (
      !candidates.some((each) =>
        each.kind === "Tag" && candidate.kind === "Tag"
          ? each.tag === candidate.tag
          : each.kind === "Component" &&
            candidate.kind === "Component" &&
            each.component === candidate.component,
      )
    ) {
      candidates.push(candidate);
    }
  }
  const is = createExpression(
    render.source.slice(expression.start, expression.end),
    span(expression),
    refs.toSorted((a, b) => a.span.start - b.span.start),
  );
  const lowered = tags
    ? lowerTags(node, name, candidates, place, render, isAttribute)
    : lowerComponents(node, name, leaves, place, render, isAttribute);
  if (!lowered || reporter.hasErrorsSince(mark)) return undefined;
  return createDynamicNode(
    is,
    candidates,
    lowered.attributes,
    lowered.children,
    span(node),
    lowered.fills,
  );
}

/**
 * The leaves of `is`: a string literal is a tag, an identifier of a component a component, a
 * conditional the leaves of its branches (its test checked as an expression), and any other
 * value a tag of each string its type allows. Pushes the references `is` reads.
 */
function leavesOf(
  node: AST.Expression | AST.StringLiteral,
  render: RenderContext,
  refs: Reference[],
): Leaf[] | undefined {
  switch (node.type) {
    case "ParenthesizedExpression":
      return leavesOf(node.expression, render, refs);
    case "Literal":
      if (typeof node.value === "string") return tag(node.value, node, render);
      break;
    case "TemplateLiteral":
      if (!node.expressions.length) return tag(node.quasis[0]!.value.cooked ?? "", node, render);
      break;
    case "ConditionalExpression": {
      const test = checkExpression(node.test, { ...render, presence: true });
      if (!test.clean) return undefined;
      refs.push(...test.expression.refs);
      const consequent = leavesOf(node.consequent, render, refs);
      const alternate = leavesOf(node.alternate, render, refs);
      return consequent && alternate ? [...consequent, ...alternate] : undefined;
    }
    case "Identifier": {
      const info = componentOf(node, render);
      if (info === null) return undefined;
      if (info) {
        refs.push(createBindingReference(componentBinding(info, node, render), span(node)));
        return [{ kind: "Component", info, node }];
      }
      break;
    }
    default:
      break;
  }
  // A value whose type allows only some strings: a prop of `"h2" | "h3"`.
  const checked = checkExpression(node as AST.Expression, render);
  if (!checked.clean) return undefined;
  const { kinds } = checked;
  if (
    kinds.strings?.size &&
    [...kinds.primitives].every((primitive) => primitive === "string") &&
    !has(kinds, "unknown")
  ) {
    refs.push(...checked.expression.refs);
    return [...kinds.strings].flatMap((value) => tag(value, node, render) ?? []);
  }
  open(
    render,
    node,
    "`is` reads a value no target can render without knowing every tag or component it may name: it is a literal, a conditional of them, a component, or a value typed as a union of tags.",
  );
  return undefined;
}

/** A tag leaf: an HTML element's name (UF3044 otherwise). */
function tag(value: string, node: AST.Node, render: RenderContext): Leaf[] | undefined {
  if (isHtmlElement(value)) return [{ kind: "Tag", tag: value, node }];
  open(render, node, `\`"${value}"\` names no HTML element: \`is\` renders an element by its tag.`);
  return undefined;
}

/**
 * The `component` binding of a component `is` names: one per component, declared where its
 * name is (an import's local name, or the function's), which only `<component is>` reads.
 */
function componentBinding(
  info: ComponentInfo,
  node: AST.IdentifierReference,
  render: RenderContext,
): string {
  const resolution = render.scopes.resolve(node);
  const declaration = (
    resolution.kind === "import" || resolution.kind === "variable" ? resolution.declaration : node
  ) as AST.BindingIdentifier;
  const at = { start: declaration.start, end: declaration.start + info.name.length };
  const existing = render.bindings.find(
    (binding) =>
      binding.kind === "component" && binding.name === info.name && binding.span.start === at.start,
  );
  if (existing) return existing.id;
  const binding = createBinding(info.name, "component", at);
  render.bindings.push(binding);
  return binding.id;
}

/** What a dynamic node holds once lowered. */
interface Lowered {
  attributes: (Attribute | ComponentAttribute)[];
  children: DynamicNode["children"];
  fills?: SlotFill[];
}

/**
 * A copy of the render context that reports into a reporter of its own and leaves the context's
 * lists as they are: each candidate after the first is checked in one, and only what it finds
 * that the first did not is reported.
 */
function probe(render: RenderContext): RenderContext {
  return {
    ...render,
    reporter: new Reporter(render.reporter.file),
    bindings: [...render.bindings],
    attached: new Map(render.attached),
    loopVariables: new Map(render.loopVariables),
    facts: {
      nestedCalls: [...render.facts.nestedCalls],
      getterKinds: new Map(render.facts.getterKinds),
      tickCallbacks: [...render.facts.tickCallbacks],
      passed: new Map(render.facts.passed),
    },
  };
}

/** Reports what each later candidate's check found that the first one's did not. */
function merge(render: RenderContext, mark: number, probes: readonly RenderContext[]): void {
  const seen = new Set(
    render.reporter.diagnostics
      .slice(mark)
      .map((each) => `${each.code} ${each.span.start} ${each.message}`),
  );
  for (const each of probes) {
    for (const diagnostic of each.reporter.diagnostics) {
      const key = `${diagnostic.code} ${diagnostic.span.start} ${diagnostic.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      render.reporter.diagnostics.push(diagnostic);
    }
  }
}

/**
 * Tag candidates (ADR-0055): each tag is checked as the element it may render, from the context
 * as it was before any of them: its placement among its ancestors (UF3003), its attributes
 * (UF3006 for one a tag does not take; a template ref attaches once whichever renders), and the
 * children inside it, which no void tag takes. The first one's lowering is the node's; what any
 * other finds besides is reported too, so the order of `is` changes nothing. A control's
 * `v-model` binds a control its tag decides, which `is` does not fix: UF3042.
 */
function lowerTags(
  node: AST.JSXElement,
  name: AST.JSXIdentifier,
  candidates: readonly DynamicCandidate[],
  place: Place,
  render: RenderContext,
  isAttribute: AST.JSXAttribute,
): Lowered | undefined {
  const tags = candidates.map((candidate) => (candidate as { tag: string }).tag);
  if (place.namespace !== "html") {
    render.reporter.report(
      "UF3001",
      name,
      `\`<component is>\` renders an HTML element (${tags.map((tag) => `<${tag}>`).join(", ")}), which cannot be inside an <${place.namespace}>: the HTML parser ends it before it.`,
      { help: "Close the <svg> first, or write the SVG element itself." },
    );
    return undefined;
  }
  const model = node.openingElement.attributes.find(
    (item): item is AST.JSXAttribute =>
      item.type === "JSXAttribute" &&
      item.name.type === "JSXIdentifier" &&
      CONTROL_MODEL.test(item.name.name),
  );
  if (model) {
    render.reporter.report(
      "UF3042",
      model.name,
      "`v-model` binds a form control, whose tag decides what it binds, and `<component is>` renders a tag only its `is` decides.",
      { help: "Write the control itself, as `<input v-model={text.value} />`." },
    );
  }
  const opening = {
    ...node.openingElement,
    attributes: node.openingElement.attributes.filter(
      (item) => item !== isAttribute && item !== model,
    ),
  };
  const content = hasContent(node.children);
  const mark = render.reporter.diagnostics.length;
  // Taken before the first tag lowers, so each later one starts from the same context.
  const probes = tags.slice(1).map(() => probe(render));
  const check = (tag: string, at: RenderContext) => {
    checkPlacement(tag, name, place.ancestors, at.reporter, !place.fill);
    const { attributes } = lowerAttributes(opening, {
      tag,
      namespace: "html",
      hasChildren: content,
      listBody: false,
      render: at,
    });
    const children = lowerChildren(
      node.children,
      {
        ancestors: [...place.ancestors, { tag, name: span(name), namespace: "html" }],
        namespace: "html",
      },
      at,
    );
    return { attributes, children };
  };
  const lowered = check(tags[0]!, render);
  for (const [index, tag] of tags.slice(1).entries()) check(tag, probes[index]!);
  merge(render, mark, probes);
  const empty = tags.find((tag) => isVoidElement(tag));
  if (empty && content) {
    render.reporter.report(
      "UF3003",
      name,
      `\`is\` may render <${empty}>, a void element, so the element cannot have children.`,
      { help: "Leave the void tag out of `is`, or move the children after the element." },
    );
  }
  return lowered;
}

/**
 * Component candidates (ADR-0055): the attributes and fills as each component's, which each must
 * declare (UF3035, UF3038 otherwise), lowered as the first one's.
 */
function lowerComponents(
  node: AST.JSXElement,
  name: AST.JSXIdentifier,
  leaves: readonly Leaf[],
  place: Place,
  render: RenderContext,
  isAttribute: AST.JSXAttribute,
): Lowered | undefined {
  const infos: ComponentInfo[] = [];
  for (const leaf of leaves) {
    if (leaf.kind === "Component" && !infos.some((each) => each.name === leaf.info.name)) {
      infos.push(leaf.info);
    }
  }
  const mark = render.reporter.diagnostics.length;
  // Taken before the first component lowers, so each later one starts from the same context.
  const probes = infos.slice(1).map(() => probe(render));
  const first = lowerComponentAs(node, name, infos[0]!, place, render, false, isAttribute);
  for (const [index, info] of infos.slice(1).entries()) {
    lowerComponentAs(node, name, info, place, probes[index]!, false, isAttribute);
  }
  merge(render, mark, probes);
  if (!first.node) return undefined;
  return { attributes: first.node.attributes, children: [], fills: first.node.fills };
}
