import { queueHook } from "./queueHook";
import { useLayoutEffect, useRef, useState } from "react";

/** The hooks of a directive, which `useElementDirective` runs on its elements. */
export interface DirectiveHooks<E extends Element, T> {
  mounted?(el: E, value: T): unknown;
  updated?(el: E, value: T, oldValue: T): unknown;
  unmounted?(el: E): unknown;
}

/**
 * Runs a directive's hooks on each element, apart, with the element's own value: a list's rows,
 * or a scoped slot a child calls with other props each time, give each element its own. It
 * returns a function that makes an element's ref callback from its value as the element renders,
 * a new one each render, which records the element with that value, and whose cleanup forgets
 * the element. `mounted` runs once the element is rendered, `updated` after a render that
 * changes its value, and `unmounted` once that element is gone, whichever component renders or
 * removes it.
 */
export function useElementDirective<E extends Element, T>(directive: DirectiveHooks<E, T>) {
  const state = useRef<{ attached: Map<E, T>; mounted: Map<E, T> }>({
    attached: new Map(),
    mounted: new Map(),
  });
  const [sync] = useState(() => () => {
    const { attached, mounted } = state.current;
    for (const element of [...mounted.keys()]) {
      if (attached.has(element)) continue;
      mounted.delete(element);
      queueHook(element, () => directive.unmounted?.(element), "unmounted");
    }
    for (const [element, value] of attached) {
      if (!mounted.has(element)) {
        mounted.set(element, value);
        queueHook(element, () => directive.mounted?.(element, value), "mounted");
        continue;
      }
      const previous = mounted.get(element) as T;
      if (Object.is(value, previous)) continue;
      mounted.set(element, value);
      queueHook(element, () => directive.updated?.(element, value, previous), "updated");
    }
  });
  const [withValue] = useState(() => (value: T) => (element: E | null) => {
    if (!element) return () => {};
    state.current.attached.set(element, value);
    queueMicrotask(sync);
    return () => {
      state.current.attached.delete(element);
      queueMicrotask(sync);
    };
  });
  useLayoutEffect(() => {
    sync();
  });
  useLayoutEffect(
    () => () => {
      state.current.attached.clear();
      sync();
    },
    [sync],
  );
  return withValue;
}
