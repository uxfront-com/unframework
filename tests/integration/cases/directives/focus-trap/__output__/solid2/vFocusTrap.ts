import { onCleanup, onSettled, untrack } from "solid-js";

interface Trap {
  previous: HTMLElement | null;
  onKeydown: (event: KeyboardEvent) => void;
}

const FOCUSABLE =
  "button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex='-1'])";
const traps = new WeakMap<HTMLElement, Trap>();

export function vFocusTrap(getValue: () => boolean): (element: HTMLElement) => void {
  const hooks = {
    mounted(el: HTMLElement, active: boolean) {
      const onKeydown = (event: KeyboardEvent) => {
        if (event.key !== "Tab") return;
        const controls = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
        const first = controls[0];
        const last = controls.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      };
      const previous =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      traps.set(el, { previous, onKeydown });
      el.addEventListener("keydown", onKeydown);
      if (active) el.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    },
    unmounted(el: HTMLElement) {
      const trap = traps.get(el);
      if (!trap) return;
      el.removeEventListener("keydown", trap.onKeydown);
      traps.delete(el);
      trap.previous?.focus();
    },
  };
  let target: HTMLElement | undefined;
  const current = untrack(getValue);
  onSettled(() => {
    const element = target;
    if (element) queueHook(element, () => hooks.mounted(element, current), "mounted");
  });
  onCleanup(() => {
    const element = target;
    if (element) queueHook(element, () => hooks.unmounted(element), "unmounted");
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
function queueHook(
  element: Element,
  run: () => void,
  hook: "mounted" | "updated" | "unmounted",
): void {
  const key: unique symbol = Symbol.for("unframework.directive-hooks@2");
  const scope = globalThis as typeof globalThis & {
    [key]?: { element: Element; run: () => void; hook: "mounted" | "updated" | "unmounted" }[];
  };
  const queued = scope[key];
  if (queued) {
    queued.push({ element, run, hook });
    return;
  }
  scope[key] = [{ element, run, hook }];
  queueMicrotask(() => {
    const hooks = scope[key] ?? [];
    scope[key] = undefined;
    // Every `unmounted` runs first, but one after its own element's `mounted` this turn, as
    // StrictMode's, which keeps its place among the rest. A leaving one moves up together
    // with the element's hooks before it, which keep their order.
    const first = new Set<(typeof hooks)[number]>();
    const entered = new Set<Element>();
    for (const each of hooks) {
      if (each.hook === "mounted") entered.add(each.element);
      if (each.hook !== "unmounted" || entered.has(each.element)) continue;
      for (const earlier of hooks) {
        if (earlier.element === each.element) first.add(earlier);
        if (earlier === each) break;
      }
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
    for (const each of hooks) {
      try {
        each.run();
      } catch (error) {
        reportError(error);
      }
    }
  });
}
