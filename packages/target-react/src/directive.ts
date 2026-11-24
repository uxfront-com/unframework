// A directive on React (ADR-0099): React has no directive, so a component that applies one calls
// an inline hook, `useDirective`, once per use at its top level, and passes the ref callback it
// returns to the element: `const focusTrapRef = useDirective(vFocusTrap, () => open)`. One use may
// render several elements, as a slot a child renders in a list, so the callback, one stable
// function, records each element it receives, and its cleanup forgets that one: an element whose
// ref callback is written in place, and so attached again at each render, keeps its directive.
// The sync, after each render's layout effects too, compares what the callback recorded with what
// it mounted: a new element is `mounted`, a value that changed (`Object.is`) `updated` on each
// element, and an element gone `unmounted`, as is each one left when the component unmounts. The
// microtask covers an element a child renders in the slot content, whose callback runs without a
// render of this component. Each hook goes through the inline `queueHook`, which runs them in
// Vue's order with every other output's. Refs and effects never run on the server. A `.uf.ts`
// module's directive is the plain hooks object, which the hook reads. A use whose value reads a
// list's row or a scoped fill's props has a value for each element, which one getter can't give,
// so it calls `useElementDirective` instead (ADR-0108), which returns a function that makes the
// element's callback from its value as the row renders, `ref={withTooltip(item.label)}`: the
// branches around the element still narrow the value there, and the callback is a new one at
// each render, which React calls again with the element, so the hook records the element with
// the value of each render.
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
export function emitDirective(directive: UfDirective, context: EmitContext): Array<OutputFile> {
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
export function directivesInPostOrder(component: UfComponent): Array<DirectiveAttribute> {
  const found: Array<DirectiveAttribute> = [];
  walk(component.render, {
    leave(node) {
      if (node.kind !== "Element") {
        return;
      }
      for (const attribute of node.attributes) {
        if (attribute.kind === "Directive") {
          found.push(attribute);
        }
      }
    },
  });
  return found;
}

/** The ref a directive's call returns, by name: `focusTrapRef` for `vFocusTrap`. */
export function directiveRefBase(name: string): string {
  return `${name[1]!.toLowerCase()}${name.slice(2)}Ref`;
}

/**
 * The inline hooks a component that applies a directive calls, and the hooks' type: `hook` for a
 * use whose value the component reads, `each` for one whose elements pass their own (ADR-0108).
 */
export function useDirectiveHelper(
  names: { hook?: string; each?: string; hooks: string; queue: string },
  imports: ImportSet,
): string {
  const react = (name: string) => imports.add("react", name);
  const { hook, each, hooks, queue } = names;
  return [
    `/** The hooks of a directive, which \`${hook ?? each}\` runs on its elements. */
interface ${hooks}<E extends Element, T> {
  mounted?(el: E, value: T): unknown;
  updated?(el: E, value: T, oldValue: T): unknown;
  unmounted?(el: E): unknown;
}`,
    ...(hook ? [useDirectiveCode(hook, hooks, queue, react)] : []),
    ...(each ? [useElementDirectiveCode(each, hooks, queue, react)] : []),
  ].join("\n\n");
}

/** `useDirective`: one use's hooks, with the value the component's getter reads. */
function useDirectiveCode(
  hook: string,
  hooks: string,
  queue: string,
  react: (name: string) => string,
): string {
  return `/**
 * Runs a directive's hooks on each element its ref callback receives, apart: \`mounted\` once
 * the element is rendered, \`updated\` after a render that changes the value, and \`unmounted\`
 * once that element is gone, whichever component renders or removes it. One use may render
 * several elements, as a slot a child renders in a list. The callback only records the element,
 * and its cleanup forgets that one, so a callback written in place keeps the directive.
 */
function ${hook}<E extends Element, T>(directive: ${hooks}<E, T>, getValue: () => T) {
  const state = ${react("useRef")}<{
    getValue: () => T;
    attached: Set<E>;
    mounted: Map<E, T>;
  }>({ getValue, attached: new Set(), mounted: new Map() });
  const [sync] = ${react("useState")}(() => () => {
    const { attached, mounted } = state.current;
    for (const element of [...mounted.keys()]) {
      if (attached.has(element)) continue;
      mounted.delete(element);
      ${queue}(element, () => directive.unmounted?.(element), "unmounted");
    }
    if (!attached.size) return;
    const value = state.current.getValue();
    for (const element of attached) {
      if (!mounted.has(element)) {
        mounted.set(element, value);
        ${queue}(element, () => directive.mounted?.(element, value), "mounted");
        continue;
      }
      const previous = mounted.get(element) as T;
      if (Object.is(value, previous)) continue;
      mounted.set(element, value);
      ${queue}(element, () => directive.updated?.(element, value, previous), "updated");
    }
  });
  const [ref] = ${react("useState")}(() => (element: E | null) => {
    if (!element) return () => {};
    state.current.attached.add(element);
    queueMicrotask(sync);
    return () => {
      state.current.attached.delete(element);
      queueMicrotask(sync);
    };
  });
  ${react("useLayoutEffect")}(() => {
    state.current.getValue = getValue;
    sync();
  });
  ${react("useLayoutEffect")}(
    () => () => {
      state.current.attached.clear();
      sync();
    },
    [sync],
  );
  return ref;
}`;
}

/** `useElementDirective`: one use's hooks, with the value each element passes beside it. */
function useElementDirectiveCode(
  hook: string,
  hooks: string,
  queue: string,
  react: (name: string) => string,
): string {
  return `/**
 * Runs a directive's hooks on each element, apart, with the element's own value: a list's rows,
 * or a scoped slot a child calls with other props each time, give each element its own. It
 * returns a function that makes an element's ref callback from its value as the element renders,
 * a new one each render, which records the element with that value, and whose cleanup forgets
 * the element. \`mounted\` runs once the element is rendered, \`updated\` after a render that
 * changes its value, and \`unmounted\` once that element is gone, whichever component renders or
 * removes it.
 */
function ${hook}<E extends Element, T>(directive: ${hooks}<E, T>) {
  const state = ${react("useRef")}<{ attached: Map<E, T>; mounted: Map<E, T> }>({
    attached: new Map(),
    mounted: new Map(),
  });
  const [sync] = ${react("useState")}(() => () => {
    const { attached, mounted } = state.current;
    for (const element of [...mounted.keys()]) {
      if (attached.has(element)) continue;
      mounted.delete(element);
      ${queue}(element, () => directive.unmounted?.(element), "unmounted");
    }
    for (const [element, value] of attached) {
      if (!mounted.has(element)) {
        mounted.set(element, value);
        ${queue}(element, () => directive.mounted?.(element, value), "mounted");
        continue;
      }
      const previous = mounted.get(element) as T;
      if (Object.is(value, previous)) continue;
      mounted.set(element, value);
      ${queue}(element, () => directive.updated?.(element, value, previous), "updated");
    }
  });
  const [withValue] = ${react("useState")}(() => (value: T) => (element: E | null) => {
    if (!element) return () => {};
    state.current.attached.set(element, value);
    queueMicrotask(sync);
    return () => {
      state.current.attached.delete(element);
      queueMicrotask(sync);
    };
  });
  ${react("useLayoutEffect")}(() => {
    sync();
  });
  ${react("useLayoutEffect")}(
    () => () => {
      state.current.attached.clear();
      sync();
    },
    [sync],
  );
  return withValue;
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

/**
 * \`mergeRefs\`: an element's refs as one ref callback, whose cleanup clears each (ADR-0108,
 * ADR-0118): a callback's own cleanup, or the callback called with \`null\`, as React does without
 * one, and a ref object's \`current\`. \`Ref\` and \`RefCallback\` are React's types' locals.
 */
export function mergeRefsHelper(name: string, types: { Ref: string; RefCallback: string }): string {
  return `/** Joins an element's refs into one ref callback, whose cleanup clears each. */
function ${name}<E extends Element>(...refs: (${types.Ref}<E> | undefined)[]): ${types.RefCallback}<E> {
  return (element) => {
    const cleanups = refs.map((ref) => {
      if (typeof ref === "function") {
        const cleanup = ref(element);
        return typeof cleanup === "function" ? cleanup : () => ref(null);
      }
      if (ref) ref.current = element;
      return () => {
        if (ref) ref.current = null;
      };
    });
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  };
}`;
}
