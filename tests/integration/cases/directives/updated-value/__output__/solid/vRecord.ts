import { createEffect, onMount, untrack } from "solid-js";

export function vRecord(getValue: () => number): (element: HTMLElement) => void {
  const hooks = {
    mounted(el: HTMLElement, value: number): void {
      el.setAttribute("data-value", String(value));
      el.setAttribute("data-updates", "0");
    },
    updated(el: HTMLElement, value: number, oldValue: number): void {
      el.setAttribute("data-value", String(value));
      el.setAttribute("data-old-value", String(oldValue));
      el.setAttribute("data-updates", String(Number(el.getAttribute("data-updates")) + 1));
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
    const previous = current;
    current = next;
    const element = target;
    if (element) queueHook(element, () => hooks.updated(element, next, previous));
  });
  return (element) => {
    target = element;
  };
}

const queuedHooks: { element: Element; run: () => void }[] = [];

/**
 * Runs a directive's hook once the turn ends, a descendant's before its ancestor's and
 * siblings' in document order, as Vue runs them.
 */
function queueHook(element: Element, run: () => void): void {
  if (!queuedHooks.length) {
    queueMicrotask(() => {
      const hooks = queuedHooks.splice(0).sort((a, b) => {
        if (a.element === b.element) return 0;
        if (a.element.contains(b.element)) return 1;
        if (b.element.contains(a.element)) return -1;
        return a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1;
      });
      for (const hook of hooks) hook.run();
    });
  }
  queuedHooks.push({ element, run });
}
