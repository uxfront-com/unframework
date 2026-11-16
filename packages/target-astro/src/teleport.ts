// `<Teleport>` on Astro (ADR-0098): a static page has no client to mount the content once the
// component has mounted, and printing it in place would put it in the server HTML, which holds no
// teleported content on any target. So the output prints nothing for it: the render tree loses
// each teleport before anything reads it, and a conditional left with nothing to render goes too,
// so a binding only the content reads is declared nowhere.
import type {
  ElementNode,
  FragmentNode,
  RenderNode,
  SlotFill,
  UfComponent,
} from "@unframework.dev/ir";

/** The component without its teleports, and its elements without their directives. */
export function withoutTeleports(component: UfComponent): UfComponent {
  return { ...component, render: root(component.render) };
}

function root(render: ElementNode | FragmentNode): ElementNode | FragmentNode {
  return render.kind === "Element"
    ? element(render)
    : { ...render, children: nodes(render.children) };
}

// A directive's hooks run in the browser (ADR-0099), so the element renders without it, and what
// only its value reads is not live.
function element(node: ElementNode): ElementNode {
  return {
    ...node,
    attributes: node.attributes.filter((attribute) => attribute.kind !== "Directive"),
    children: nodes(node.children),
  };
}

function fills(list: readonly SlotFill[]): SlotFill[] {
  return list.map((fill) => ({ ...fill, children: nodes(fill.children) }));
}

function nodes(list: readonly RenderNode[]): RenderNode[] {
  return list.flatMap((node): RenderNode[] => {
    switch (node.kind) {
      case "Teleport":
        return [];
      case "Element":
        return [element(node)];
      case "If": {
        const branches = node.branches.map((branch) => ({
          ...branch,
          children: nodes(branch.children),
        }));
        // A conditional whose every branch held only a teleport renders nothing.
        return branches.every((branch) => !branch.children.length) ? [] : [{ ...node, branches }];
      }
      case "For":
        return [
          {
            ...node,
            body:
              node.body.kind === "Element"
                ? element(node.body)
                : { ...node.body, fills: fills(node.body.fills) },
          },
        ];
      case "Component":
        return [{ ...node, fills: fills(node.fills) }];
      case "SlotOutlet":
        return [{ ...node, fallback: nodes(node.fallback) }];
      case "Dynamic":
        return [
          {
            ...node,
            children: nodes(node.children),
            ...(node.fills ? { fills: fills(node.fills) } : {}),
          },
        ];
      case "Text":
      case "Interpolation":
        return [node];
      default:
        return node satisfies never;
    }
  });
}
