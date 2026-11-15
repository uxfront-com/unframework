import { createEffect, onCleanup, onMount, untrack } from "solid-js";

interface Outside {
  callback: () => void;
  onClick: (event: MouseEvent) => void;
}

const outsides = new WeakMap<HTMLElement, Outside>();

export function vClickOutside(getValue: () => () => void): (element: HTMLElement) => void {
  const hooks = {
    mounted(el: HTMLElement, callback: () => void) {
      const outside: Outside = {
        callback,
        onClick: (event) => {
          if (!el.contains(event.target as Node)) outside.callback();
        },
      };
      outsides.set(el, outside);
      document.addEventListener("click", outside.onClick);
    },
    updated(el: HTMLElement, callback: () => void) {
      const outside = outsides.get(el);
      if (outside) outside.callback = callback;
    },
    unmounted(el: HTMLElement) {
      const outside = outsides.get(el);
      if (outside) document.removeEventListener("click", outside.onClick);
      outsides.delete(el);
    },
  };
  let target: HTMLElement | undefined;
  let current = untrack(getValue);
  onMount(() => {
    const element = target;
    if (element) queueHook(element, () => hooks.mounted(element, current));
  });
  createEffect(() => {
    const next = getValue();
    if (Object.is(next, current)) return;
    current = next;
    const element = target;
    if (element) queueHook(element, () => hooks.updated(element, next));
  });
  onCleanup(() => {
    const element = target;
    if (element) queueHook(element, () => hooks.unmounted(element), true);
  });
  return (element) => {
    target = element;
  };
}

/**
 * Runs a directive's hook once the turn ends, as Vue runs them: the elements that leave first,
 * then a descendant's before its ancestor's and siblings' in document order, one element's in
 * the order they came, with the hooks every other output queued.
 */
function queueHook(element: Element, run: () => void, leaving = false): void {
  const key: unique symbol = Symbol.for("unframework.directive-hooks@1");
  const scope = globalThis as typeof globalThis & {
    [key]?: { element: Element; run: () => void; leaving: boolean }[];
  };
  const queued = scope[key];
  if (queued) {
    queued.push({ element, run, leaving });
    return;
  }
  scope[key] = [{ element, run, leaving }];
  queueMicrotask(() => {
    const hooks = scope[key] ?? [];
    scope[key] = undefined;
    // An element whose first hook of the turn is `unmounted` leaves before any other mounts.
    const leaves = new Map<Element, boolean>();
    for (const hook of hooks) {
      if (!leaves.has(hook.element)) leaves.set(hook.element, hook.leaving);
    }
    hooks.sort((a, b) => {
      if (a.element === b.element) return 0;
      const leaving = leaves.get(a.element) === true;
      if (leaving !== (leaves.get(b.element) === true)) return leaving ? -1 : 1;
      if (a.element.contains(b.element)) return 1;
      if (b.element.contains(a.element)) return -1;
      return a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING
        ? -1
        : 1;
    });
    for (const hook of hooks) {
      try {
        hook.run();
      } catch (error) {
        reportError(error);
      }
    }
  });
}
