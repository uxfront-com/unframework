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

@Directive({ selector: "[vMark]" })
export class VMark {
  readonly vMark = input.required<string>();
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const hooks = {
      mounted(el: HTMLElement, value: string): void {
        el.setAttribute("data-directive-mounted", value);
      },
    };
    const element = this.element.nativeElement;
    let last: { value: string } | undefined;
    afterRenderEffect(() => {
      const value = this.vMark();
      const previous = last;
      last = { value };
      if (!previous) queueHook(element, () => hooks.mounted(element, value));
    });
  }
}
