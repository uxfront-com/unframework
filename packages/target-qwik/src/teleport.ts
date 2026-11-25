// `<Teleport to>` on Qwik (ADR-0098). Qwik has no portal. The content renders once a visible task
// says the component has mounted, so the server renders none of it, and an inline helper moves
// its element into `to` once Qwik has inserted it. Qwik inserts a new node before the first DOM
// node of the vnode that follows it (`vnode_findInsertBefore`), which throws where that node has
// moved: the element follows the empty text Qwik renders for `{""}`, in a fragment, so the
// fragment's first DOM node is that text, which stays where Qwik put it. Qwik removes a node with
// `remove()`, wherever it is, and removes the element itself with its branch; where Qwik removes
// an element around the teleport, or the component, the helper removes it once the element that
// held it leaves the document. Qwik also finds a
// handler's container up from its element (`getDomContainer`), so an element moved out of its
// container carries the container's `q:container` and its `qContainer`, and stands in for it: its
// handlers then run in the component's container, as they do where `to` is inside it (an SSR
// page, whose container is `<html>`).
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
	/** The selector of a Qwik container's element. */
	container: string;
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
				container: names.once("QWIK_CONTAINER"),
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
export function teleportHelper({ helper: name, taken, container }: TeleportNames): string {
	return `/** The elements \`${name}\` has taken. */
const ${taken} = new WeakSet<Element>();

/** The element of a Qwik container, as Qwik selects it. */
const ${container} = "[q\\\\:container]:not([q\\\\:container=html]):not([q\\\\:container=text])";

/**
 * A ref that moves its element into the element \`to\` selects once Qwik has inserted it, after the
 * empty text before it. The element sits after an empty text of its own in \`to\`, which keeps its
 * place: when Qwik moves the element with its component, it goes back after that text, whatever
 * else moved. It removes the element once the element that held it leaves the document: Qwik
 * removes the element itself with its branch, and only the outermost node of an element it
 * removes. It stops watching once the element is gone. Moved out of its Qwik container, the
 * element stands in for it, so its handlers still find their container.
 */
function ${name}(to: string): (element: Element) => void {
  return (element) => {
    if (${taken}.has(element)) return;
    ${taken}.add(element);
    let holder: Node | null = null;
    // Where the element sits in \`to\`: an empty text, which no capture shows and nothing else moves.
    const place = document.createTextNode("");
    const move = () => {
      const active = document.activeElement;
      place.after(element);
      // Moving a node blurs what it holds, which a component inside it may have focused.
      if (active instanceof HTMLElement && element.contains(active)) active.focus();
    };
    const observer = new MutationObserver(() => {
      if (holder === null) {
        if (!element.isConnected) return;
        holder = element.parentNode;
        const target = document.querySelector(to);
        if (!target || !holder || !element.previousSibling) {
          element.remove();
          observer.disconnect();
          return;
        }
        // Qwik finds a handler's container up from its element (\`getDomContainer\`): outside it,
        // the element stands in for it.
        const container = element.closest(${container});
        if (container && target.closest(${container}) !== container) {
          element.setAttribute("q:container", container.getAttribute("q:container") ?? "");
          Object.assign(element, { qContainer: Reflect.get(container, "qContainer") });
        }
        target.append(place);
        move();
        return;
      }
      if (!holder.isConnected) {
        // An element around the teleport, or its component, has gone.
        element.remove();
      } else if (element.isConnected) {
        // Qwik moves a component's nodes with it, as a keyed list reorders it: back to its place.
        if (element.previousSibling !== place) move();
        return;
      }
      // Removed, by Qwik with its branch or here.
      place.remove();
      observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  };
}`;
}
