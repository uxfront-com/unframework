import { DestroyRef, Directive, ElementRef, afterRenderEffect, inject, input } from "@angular/core";

interface Trap {
  previous: HTMLElement | null;
  onKeydown: (event: KeyboardEvent) => void;
}

const FOCUSABLE =
  "button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex='-1'])";
const traps = new WeakMap<HTMLElement, Trap>();

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

@Directive({ selector: "[vFocusTrap]" })
export class VFocusTrap {
  readonly vFocusTrap = input.required<boolean>();
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const hooks = {
      mounted(el: HTMLElement, active: boolean): void {
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
      unmounted(el: HTMLElement): void {
        const trap = traps.get(el);
        if (!trap) return;
        el.removeEventListener("keydown", trap.onKeydown);
        traps.delete(el);
        trap.previous?.focus();
      },
    };
    const element = this.element.nativeElement;
    let last: { value: boolean } | undefined;
    afterRenderEffect(() => {
      const value = this.vFocusTrap();
      const previous = last;
      last = { value };
      if (!previous) queueHook(element, () => hooks.mounted(element, value));
    });
    inject(DestroyRef).onDestroy(() => {
      if (last) queueHook(element, () => hooks.unmounted(element));
    });
  }
}
