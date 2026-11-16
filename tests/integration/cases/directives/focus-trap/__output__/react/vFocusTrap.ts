interface Trap {
  previous: HTMLElement | null;
  onKeydown: (event: KeyboardEvent) => void;
}

const FOCUSABLE =
  "button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex='-1'])";
const traps = new WeakMap<HTMLElement, Trap>();

export const vFocusTrap = {
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
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
