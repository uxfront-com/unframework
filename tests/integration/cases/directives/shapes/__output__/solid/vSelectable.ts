import { onMount as onMount_1, untrack as untrack_1 } from "solid-js";

type Field = HTMLInputElement | HTMLTextAreaElement;

const untrack = "data-untrack";
const onMount = "mounted";
const queueHook = "data-queue";
const ObjectDirective = "queued";

export function vSelectable(getValue: () => boolean): (element: Field) => void {
  const hooks = {
    mounted(el: Field, value: boolean) {
      el.setAttribute("data-selectable", String(value));
      el.setAttribute(untrack, onMount);
      el.setAttribute(queueHook, ObjectDirective);
    },
  };
  let target: Field | undefined;
  const current = untrack_1(getValue);
  onMount_1(() => {
    const element = target;
    if (element) queueHook_1(element, () => hooks.mounted(element, current));
  });
  return (element) => {
    target = element;
  };
}

/**
 * Runs a directive's hook once the turn ends, as Vue runs them: every `unmounted` first, then
 * a descendant's before its ancestor's and siblings' in document order, one element's in the
 * order they came, with the hooks every other output queued.
 */
function queueHook_1(element: Element, run: () => void, leaving = false): void {
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
    // Every `unmounted` runs first, but one after its own element's `mounted` this turn, as
    // StrictMode's, which keeps its place among the rest.
    const first = new Set<{ element: Element; run: () => void; leaving: boolean }>();
    const entered = new Set<Element>();
    for (const hook of hooks) {
      if (!hook.leaving) entered.add(hook.element);
      else if (!entered.has(hook.element)) first.add(hook);
    }
    hooks.sort((a, b) => {
      if (first.has(a) !== first.has(b)) return first.has(a) ? -1 : 1;
      if (a.element === b.element) return 0;
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
