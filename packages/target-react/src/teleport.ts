// `<Teleport to>` on React (ADR-0098): a portal, once the component has mounted. React 19's
// server render (Fizz) throws on a portal, so the component reads whether it has mounted from
// `useSyncExternalStore`, false on the server and while the client hydrates, and true after: the
// element is portalled into the element `to` selects by a helper, `teleport`, which
// renders nothing when no element matches.
import { js, jsxNode } from "@unframework.dev/codegen";
import type { ImportSet, JsxDialect } from "@unframework.dev/codegen";

import type { ReactPlan, TeleportNames } from "./plan.ts";

/** The dialect's `teleport` hook: `mounted ? teleport(<div …/>, "body") : null`. */
export function teleportCall(plan: ReactPlan): JsxDialect["teleport"] {
  const names = plan.helpers.teleport;
  if (!names) return undefined;
  return (node, context) =>
    js.conditionalExpression(
      js.identifier(names.mounted),
      js.callExpression(js.identifier(names.helper), [
        jsxNode(node.children[0]!, context),
        js.stringLiteral(node.to),
      ]),
      js.nullLiteral(),
    );
}

/** The inline helpers a teleport needs, after the component. */
export function teleportHelpers(names: TeleportNames, imports: ImportSet): string[] {
  return [
    `/** Subscribes to nothing: whether the component has mounted never changes once it has. */
function ${names.subscribe}(): () => void {
  return () => {};
}`,
    teleportHelper(names.helper, imports),
  ];
}

/** The `teleport` helper, which portals an element into the element a selector matches. */
export function teleportHelper(name: string, imports: ImportSet): string {
  const createPortal = imports.add("react-dom", "createPortal");
  const node = imports.add("react", "ReactNode", { type: true });
  const portal = imports.add("react", "ReactPortal", { type: true });
  return `/** Portals \`children\` into the element \`to\` selects, or renders nothing where none does. */
function ${name}(children: ${node}, to: string): ${portal} | null {
  const target = document.querySelector(to);
  return target ? ${createPortal}(children, target) : null;
}`;
}
