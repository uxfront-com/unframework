// `<Teleport to="body">` (ADR-0098): content that mounts into the element `to` selects, once its
// component has mounted, and renders nothing on the server. `Teleport` is an authoring API
// written only as a tag, recognised by the binding its import declares, never by name. `to` is a
// static selector (UF3053), and the content is exactly one element (UF3054), the one node
// Svelte, Angular and Qwik move into `to`.

import { createTeleportNode } from "@unframework.dev/ir";
import type { TeleportNode } from "@unframework.dev/ir";
import type { AST } from "@unframework.dev/parser";

import { misplacedKey } from "./attributes.ts";
import type { Reporter } from "./context.ts";
import { closest } from "./cross-component.ts";
import { span } from "./expressions.ts";
import { readJsxText } from "./jsx/text.ts";
import { isStaticString, valueOf } from "./literals.ts";
import { lowerElement, ROOT } from "./lower.ts";
import type { Place } from "./lower.ts";
import type { RenderContext } from "./render.ts";

/** Whether a tag names the authoring API's `Teleport`, by the binding its import declares. */
export function isTeleportTag(name: AST.JSXIdentifier, render: RenderContext): boolean {
  const resolution = render.scopes.resolve(name as unknown as AST.IdentifierReference);
  return (
    resolution.kind === "import" &&
    render.setup.authoring.get(resolution.declaration) === "Teleport"
  );
}

/**
 * Reports `Teleport` used as anything but a tag (UF1002, ADR-0098): called, or read as a value.
 * No target has a value to give it, since each writes the content its own way.
 */
export function teleportNotTag(node: AST.IdentifierReference, reporter: Reporter): void {
  reporter.unsupported(
    node,
    `\`${node.name}\` is only written as a tag: each target mounts its content its own way, so it is no function to call or value to pass.`,
    { help: `Write \`<${node.name} to="…">\` in the markup.` },
  );
}

/** What a teleport's content is, as written: its children that render something. */
function contentOf(items: readonly AST.JSXChild[]): AST.JSXChild[] {
  return items.filter((item) => {
    if (item.type === "JSXText") return readJsxText(item.value).value !== "";
    if (item.type === "JSXExpressionContainer")
      return item.expression.type !== "JSXEmptyExpression";
    return true;
  });
}

/** Whether a child is a plain element: a lower-case tag, not `<component is>`. */
function isPlainElement(item: AST.JSXChild): item is AST.JSXElement {
  if (item.type !== "JSXElement") return false;
  const { name } = item.openingElement;
  return name.type === "JSXIdentifier" && /^[a-z]/.test(name.name) && name.name !== "component";
}

/**
 * Lowers `<Teleport to>` (ADR-0098). Returns the node, or `undefined` when it is reported; a
 * content that is one element is still checked. `listBody` marks the element a list's `.map`
 * renders, which a teleport cannot be.
 */
export function lowerTeleport(
  node: AST.JSXElement,
  name: AST.JSXIdentifier,
  place: Place,
  render: RenderContext,
  listBody: boolean,
): TeleportNode | undefined {
  const { reporter } = render;
  const mark = reporter.diagnostics.length;
  if (listBody) {
    reporter.unsupported(
      name,
      `<${name.name}> as the element a list renders is not supported: a list renders an element or a component, which takes its \`key\`.`,
      { help: `Wrap the <${name.name}> in an element that takes the \`key\`.` },
    );
    return undefined;
  }
  if (place.namespace !== "html") {
    reporter.unsupported(
      name,
      `<${name.name}> inside an <svg> is not supported: its content is an HTML element, which mounts outside the <svg>.`,
      { help: `Move the <${name.name}> out of the <svg>.` },
    );
    return undefined;
  }
  const to = selectorOf(node, name, render);
  const content = contentOf(node.children);
  const [first, second] = content;
  if (!first || second || !isPlainElement(first)) {
    const offending = second && first && isPlainElement(first) ? second : first;
    reporter.report(
      "UF3054",
      offending ?? name,
      offending
        ? `<${name.name}> holds exactly one element, and this ${second && offending === second ? "is a second node" : describeChild(offending)}: Svelte, Angular and Qwik move one element into \`to\`, and remove it on unmount.`
        : `<${name.name}> holds nothing: it holds exactly one element, which it mounts into \`to\`.`,
      {
        help: "Wrap the content in one element, and put a condition around the <Teleport>, not inside it.",
      },
    );
    return undefined;
  }
  // The content's parent is `to`'s element, not anything around the teleport: it is lowered as a
  // component's root is, with no open element around it.
  const lowered = lowerElement(first, ROOT, render).element;
  if (!lowered || to === undefined || reporter.hasErrorsSince(mark)) return undefined;
  return createTeleportNode(to, [lowered], span(node));
}

/** What a child that is not one plain element is, for UF3054's message. */
function describeChild(item: AST.JSXChild): string {
  switch (item.type) {
    case "JSXText":
      return "is text";
    case "JSXExpressionContainer":
      return "is an expression, which renders text, a conditional, a list or a slot";
    case "JSXFragment":
      return "is a fragment";
    case "JSXSpreadChild":
      return "is a spread";
    case "JSXElement":
      return item.openingElement.name.type === "JSXIdentifier" &&
        item.openingElement.name.name === "component"
        ? "is `<component is>`"
        : "is a component";
  }
}

/**
 * The selector `to` holds, or `undefined` when it is reported (UF3053): a static string that is
 * not empty. Every other attribute is reported as the code an element or a component would get.
 */
function selectorOf(
  node: AST.JSXElement,
  name: AST.JSXIdentifier,
  render: RenderContext,
): string | undefined {
  const { reporter } = render;
  let to: string | undefined;
  let found: AST.JSXAttribute | undefined;
  let after = name.end;
  const help = 'Write the selector as a string: `to="body"`.';
  for (const item of node.openingElement.attributes) {
    const previous = after;
    after = item.end;
    if (item.type === "JSXSpreadAttribute") {
      reporter.unsupported(
        item,
        `A spread on <${name.name}> is not supported: it takes \`to\`, written out.`,
        { help },
      );
      continue;
    }
    const written =
      item.name.type === "JSXIdentifier"
        ? item.name.name
        : `${item.name.namespace.name}:${item.name.name.name}`;
    if (written === "key" || written.toLowerCase() === "key") {
      misplacedKey(item, previous, reporter);
      continue;
    }
    if (written === "ref") {
      reporter.report(
        "UF3046",
        item,
        `<${name.name}> exposes nothing, so a ref on it holds nothing to call.`,
        { help: "Put the ref on the element inside the <Teleport>." },
      );
      continue;
    }
    if (written !== "to") {
      const meant = closest(written, ["to"]);
      reporter.report(
        "UF3035",
        item.name,
        `<${name.name}> takes no prop \`${written}\`: it takes \`to\`, the selector of the element its content mounts into.${meant ? " Did you mean `to`?" : ""}`,
        { help: "Remove it, or put it on the element inside the <Teleport>." },
      );
      continue;
    }
    if (found) {
      reporter.report("UF3007", item.name, `\`to\` is set twice on this <${name.name}>.`, {
        help: "Keep one.",
        related: [{ span: span(found.name), message: "First set here" }],
      });
      continue;
    }
    found = item;
    const { value } = item;
    const expression =
      value?.type === "Literal"
        ? value
        : value?.type === "JSXExpressionContainer" && value.expression.type !== "JSXEmptyExpression"
          ? value.expression
          : undefined;
    if (!expression || !isStaticString(expression)) {
      reporter.report(
        "UF3053",
        item,
        `\`to\` is ${expression ? "bound" : "written without a value"}: each target selects the element from the selector as written, so it is a string literal.`,
        { help },
      );
      continue;
    }
    const selector = valueOf(expression);
    if (!selector.trim()) {
      reporter.report("UF3053", item, "`to` is empty: it is the selector of an element.", {
        help,
      });
      continue;
    }
    to = selector;
  }
  if (!found) {
    reporter.report(
      "UF3053",
      name,
      `<${name.name}> takes \`to\`, the selector of the element its content mounts into.`,
      { help },
    );
  }
  return to;
}
