import { Directive, ElementRef, afterRenderEffect, inject, input } from "@angular/core";

/**
 * Runs a directive's hook once the turn ends, a descendant's before its ancestor's and
 * siblings' in document order, as Vue runs them, with the hooks every other output queued.
 */
function queueHook(element: Element, run: () => void): void {
  const key: unique symbol = Symbol.for("unframework.directive-hooks");
  const scope = globalThis as typeof globalThis & {
    [key]?: { element: Element; run: () => void }[];
  };
  const queued = scope[key];
  if (queued) {
    queued.push({ element, run });
    return;
  }
  scope[key] = [{ element, run }];
  queueMicrotask(() => {
    const hooks = scope[key] ?? [];
    scope[key] = undefined;
    hooks.sort((a, b) => {
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

@Directive({ selector: "[vRecord]" })
export class VRecord {
  readonly vRecord = input.required<number>();
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const hooks = {
      mounted(el: HTMLElement, value: number) {
        el.setAttribute("data-value", String(value));
        el.setAttribute("data-updates", "0");
      },
      updated(el: HTMLElement, value: number, oldValue: number) {
        el.setAttribute("data-value", String(value));
        el.setAttribute("data-old-value", String(oldValue));
        el.setAttribute("data-updates", String(Number(el.getAttribute("data-updates")) + 1));
      },
    };
    const element = this.element.nativeElement;
    let last: { value: number } | undefined;
    afterRenderEffect(() => {
      const value_1 = this.vRecord();
      const previous = last;
      last = { value: value_1 };
      if (!previous) queueHook(element, () => hooks.mounted(element, value_1));
      else if (!Object.is(value_1, previous.value)) {
        queueHook(element, () => hooks.updated(element, value_1, previous.value));
      }
    });
  }
}
