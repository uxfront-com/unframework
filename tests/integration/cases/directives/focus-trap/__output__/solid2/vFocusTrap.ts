import { queueHook } from "./_unframework/queueHook";
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
