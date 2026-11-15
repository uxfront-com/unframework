import { DestroyRef, Directive, ElementRef, afterRenderEffect, inject, input } from "@angular/core";

interface Outside {
  callback: () => void;
  onClick: (event: MouseEvent) => void;
}

const outsides = new WeakMap<HTMLElement, Outside>();

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

@Directive({ selector: "[vClickOutside]" })
export class VClickOutside {
  readonly vClickOutside = input.required<() => void>();
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
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
    const element = this.element.nativeElement;
    let last: { value: () => void } | undefined;
    afterRenderEffect(() => {
      const value = this.vClickOutside();
      const previous = last;
      last = { value: value };
      if (!previous) queueHook(element, () => hooks.mounted(element, value));
      else if (!Object.is(value, previous.value)) {
        queueHook(element, () => hooks.updated(element, value));
      }
    });
    inject(DestroyRef).onDestroy(() => {
      if (last) queueHook(element, () => hooks.unmounted(element));
    });
  }
}
