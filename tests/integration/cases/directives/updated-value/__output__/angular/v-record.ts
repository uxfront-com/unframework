import { Directive, ElementRef, afterRenderEffect, inject, input } from "@angular/core";

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

@Directive({ selector: "[vRecord]" })
export class VRecord {
  readonly vRecord = input.required<number>();
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
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
    const element = this.element.nativeElement;
    let last: { value: number } | undefined;
    afterRenderEffect(() => {
      const value = this.vRecord();
      const previous = last;
      last = { value };
      if (!previous) queueHook(element, () => hooks.mounted(element, value));
      else if (!Object.is(value, previous.value)) {
        queueHook(element, () => hooks.updated(element, value, previous.value));
      }
    });
  }
}
