// `<Teleport to>` on Qwik (ADR-0098). Qwik has no portal. The content renders once a visible task
// says the component has mounted, so the server renders none of it, and an inline helper moves
// its element into `to` once Qwik has inserted it. Qwik inserts a new node before the first DOM
// node of the vnode that follows it (`vnode_findInsertBefore`), which throws where that node has
// moved: the element follows the empty text Qwik renders for `{""}`, in a fragment, so the
// fragment's first DOM node is that text, which stays where Qwik put it. Qwik removes a node with
// `remove()`, wherever it is, and the helper removes the element once the text leaves the
// document, as it does when a branch or an element around the teleport goes.
import { js, jsxElement } from "@unframework.dev/codegen";
import type { JsxDialect } from "@unframework.dev/codegen";
import { walk } from "@unframework.dev/ir";
import type { ElementNode, UfComponent } from "@unframework.dev/ir";

import type { OutputNames } from "./plan.ts";

/** The names a component's teleports need. */
export interface TeleportNames {
  /** The signal that turns true once the component has mounted. */
  mounted: string;
  /** The inline helper whose ref moves an element into `to`. */
  helper: string;
  /** The elements the helper has taken, which a later render's ref leaves alone. */
  taken: string;
}

/** The names a component's teleports need, claimed where its template holds one. */
export function teleportNames(
  component: UfComponent,
  names: OutputNames,
): TeleportNames | undefined {
  let found = false;
  walk(component.render, {
    enter(node) {
      if (node.kind === "Teleport") found = true;
    },
  });
  return found
    ? {
        mounted: names.fresh("mounted"),
        helper: names.once("teleport"),
        taken: names.once("teleported"),
      }
    : undefined;
}

/** The component's statements: the signal, and the visible task that sets it. */
export function teleportSetup(teleport: TeleportNames, names: OutputNames): string {
  return [
    `const ${teleport.mounted} = ${names.core("useSignal")}(false);`,
    `${names.core("useVisibleTask$")}(() => {\n${teleport.mounted}.value = true;\n}, { strategy: "document-ready" });`,
  ].join("\n");
}

/** The dialect's `teleport` hook: `mounted.value && <>{""}<div ref={teleport("body")} …/></>`. */
export function teleportJsx(teleport: TeleportNames): NonNullable<JsxDialect["teleport"]> {
  return (node, context) => {
    const ref = js.jsxAttribute(
      "ref",
      js.jsxExpressionContainer(
        js.callExpression(js.identifier(teleport.helper), [js.stringLiteral(node.to)]),
      ),
    );
    return js.logicalExpression(
      "&&",
      js.memberExpression(js.identifier(teleport.mounted), "value"),
      js.jsxFragment([
        js.jsxExpressionContainer(js.stringLiteral("")),
        jsxElement(node.children[0] as ElementNode, context, [ref]),
      ]),
    );
  };
}

/**
 * The inline helper, after the component. Qwik calls a ref again when its value changes, and each
 * render makes a new one, so the helper takes an element once.
 */
export function teleportHelper({ helper: name, taken }: TeleportNames): string {
  return `/** The elements \`${name}\` has taken. */
const ${taken} = new WeakSet<Element>();

/**
 * A ref that moves its element into the element \`to\` selects once Qwik has inserted it, after the
 * empty text before it, and removes it once that text leaves the document.
 */
function ${name}(to: string): (element: Element) => void {
  return (element) => {
    if (${taken}.has(element)) return;
    ${taken}.add(element);
    let anchor: Node | null = null;
    const observer = new MutationObserver(() => {
      if (anchor === null) {
        if (!element.isConnected) return;
        anchor = element.previousSibling;
        const target = document.querySelector(to);
        if (target && anchor) {
          target.append(element);
          return;
        }
      } else if (anchor.isConnected) {
        return;
      }
      element.remove();
      observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  };
}`;
}
