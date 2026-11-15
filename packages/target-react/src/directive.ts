// A directive on React (ADR-0099): React has no directive, so a component that applies one calls
// an inline hook, `useDirective`, once per element at its top level, and passes the ref callback
// it returns to the element: `const focusTrapRef = useDirective(vFocusTrap, () => open)`. The
// callback is one stable function, which only records the element and schedules a sync, so an
// element whose ref callback is written in place, and so attached again at each render, keeps its
// directive. The sync, after each render's layout effects too, compares what the callback
// recorded with what it mounted: a new element is `mounted`, a value that changed (`Object.is`)
// `updated`, and an element gone `unmounted`, as is the one left when the component unmounts.
// The microtask covers an element a child renders in the slot content, whose callback runs
// without a render of this component. Each hook goes through the inline `queueHook`, which runs
// them in Vue's order with every other output's. Refs and effects never run on the server. A
// `.uf.ts` module's directive is the plain hooks object, which the hook reads.
import {
  dependencyImports,
  directiveDependencies,
  directiveHooksObject,
} from "@unframework.dev/codegen";
import type { EmitContext, ImportSet, OutputFile } from "@unframework.dev/codegen";
import { walk } from "@unframework.dev/ir";
import type { DirectiveAttribute, RenderNode, UfComponent, UfDirective } from "@unframework.dev/ir";

/** `const vTrace = { mounted(el: HTMLElement, value: string): void { … } };`, the plain hooks. */
export function hooksCode(directive: UfDirective, exported = false): string {
  return `${exported ? "export " : ""}const ${directive.name} = ${directiveHooksObject(directive)};`;
}

/** `vFocusTrap.ts`: a `.uf.ts` module's directive, as its plain hooks. */
export function emitDirective(directive: UfDirective, context: EmitContext): OutputFile[] {
  const dependencies = directiveDependencies(directive, context.module);
  const code = [
    ...(dependencyImports(dependencies).length ? [dependencyImports(dependencies).join("\n")] : []),
    ...dependencies.types,
    ...(dependencies.constants.length ? [dependencies.constants.join("\n")] : []),
    hooksCode(directive, true),
  ].join("\n\n");
  return [{ path: `${directive.name}.ts`, contents: `${code}\n` }];
}

/**
 * The directives a component's elements apply, in a post-order of the elements (a descendant's
 * before its ancestor's, siblings' in document order), each element's in attribute order.
 */
export function directivesInPostOrder(component: UfComponent): DirectiveAttribute[] {
  const found: DirectiveAttribute[] = [];
  walk(component.render, {
    leave(node) {
      if (node.kind !== "Element") return;
      for (const attribute of node.attributes) {
        if (attribute.kind === "Directive") found.push(attribute);
      }
    },
  });
  return found;
}

/** The ref a directive's call returns, by name: `focusTrapRef` for `vFocusTrap`. */
export function directiveRefBase(name: string): string {
  return `${name[1]!.toLowerCase()}${name.slice(2)}Ref`;
}

/** The inline hook a component that applies a directive calls, the hooks' type and the queue. */
export function useDirectiveHelper(
  names: { hook: string; hooks: string; queue: string },
  imports: ImportSet,
): string {
  const react = (name: string) => imports.add("react", name);
  const { hook, hooks, queue } = names;
  return `/** The hooks of a directive, which \`${hook}\` runs on its element. */
interface ${hooks}<E extends Element, T> {
  mounted?(el: E, value: T): unknown;
  updated?(el: E, value: T, oldValue: T): unknown;
  unmounted?(el: E): unknown;
}

/**
 * Runs a directive's hooks on the element its ref callback receives: \`mounted\` once it is
 * rendered, \`updated\` after a render that changes the value, and \`unmounted\` once it is gone,
 * whichever component renders or removes it. The callback only records the element, so one
 * written in place, attached again at each render, keeps the directive.
 */
function ${hook}<E extends Element, T>(directive: ${hooks}<E, T>, getValue: () => T) {
  const state = ${react("useRef")}<{
    element: E | null;
    getValue: () => T;
    mounted: E | null;
    value?: T;
  }>({ element: null, getValue, mounted: null });
  const [sync] = ${react("useState")}(() => () => {
    const current = state.current;
    const { element, mounted } = current;
    if (mounted && mounted !== element) {
      current.mounted = null;
      ${queue}(mounted, () => directive.unmounted?.(mounted));
    }
    if (!element) return;
    const value = current.getValue();
    if (current.mounted !== element) {
      current.mounted = element;
      current.value = value;
      ${queue}(element, () => directive.mounted?.(element, value));
    } else if (!Object.is(value, current.value)) {
      const previous = current.value as T;
      current.value = value;
      ${queue}(element, () => directive.updated?.(element, value, previous));
    }
  });
  const [ref] = ${react("useState")}(() => (element: E | null) => {
    state.current.element = element;
    queueMicrotask(sync);
  });
  ${react("useLayoutEffect")}(() => {
    state.current.getValue = getValue;
    sync();
  });
  ${react("useLayoutEffect")}(
    () => () => {
      state.current.element = null;
      sync();
    },
    [sync],
  );
  return ref;
}`;
}

/** Whether a node or any node inside it applies a directive. */
export function appliesDirective(node: RenderNode): boolean {
  let found = false;
  walk(node, {
    enter(each) {
      if (
        each.kind === "Element" &&
        each.attributes.some((attribute) => attribute.kind === "Directive")
      ) {
        found = true;
      }
    },
  });
  return found;
}
