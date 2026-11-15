import { DestroyRef, Directive, ElementRef, afterRenderEffect, inject, input } from "@angular/core";

interface Trap {
  previous: HTMLElement | null;
  onKeydown: (event: KeyboardEvent) => void;
}

const FOCUSABLE =
  "button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex='-1'])";
const traps = new WeakMap<HTMLElement, Trap>();

/** The hooks of a directive, which `runDirective` runs on its element. */
interface DirectiveHooks<E extends Element, T> {
  mounted?(el: E, value: T): unknown;
  updated?(el: E, value: T, oldValue: T): unknown;
  unmounted?(el: E): unknown;
}

/** The checks `watchDocument` calls, and its observer while it has any. */
const documentWatches: { checks: Set<() => void>; observer?: MutationObserver } = {
  checks: new Set(),
};

/**
 * Calls `check` after each change to the document's tree, through one `MutationObserver` for
 * every watch, and returns the end of the watch.
 */
function watchDocument(check: () => void): () => void {
  const { checks } = documentWatches;
  if (!documentWatches.observer) {
    documentWatches.observer = new MutationObserver(() => {
      for (const each of [...checks]) each();
    });
    documentWatches.observer.observe(document, { childList: true, subtree: true });
  }
  checks.add(check);
  return () => {
    checks.delete(check);
    if (!checks.size) {
      documentWatches.observer?.disconnect();
      documentWatches.observer = undefined;
    }
  };
}

/**
 * Each directive's elements: the value each last received, whether `mounted` ran, how many runs
 * took it up, and the end of its watch on the document.
 */
const directiveStates = new WeakMap<
  object,
  WeakMap<Element, { value: unknown; mounted: boolean; runs: number; unwatch: () => void }>
>();

/**
 * Runs a directive's hooks on its element: `mounted` once the element is in the document,
 * `updated` for a value that changed while it is, and `unmounted` once it leaves, which
 * projected content may do and come back. The stop it returns, called when the element's owner
 * goes, unmounts the element a microtask later, unless a later run took it up.
 */
function runDirective<E extends Element, T>(
  directive: DirectiveHooks<E, T>,
  element: E,
  value: T,
): () => void {
  let own = directiveStates.get(directive);
  if (!own) {
    own = new WeakMap();
    directiveStates.set(directive, own);
  }
  const elements = own;
  const sync = () => {
    const current = elements.get(element);
    if (!current || current.mounted === element.isConnected) return;
    current.mounted = element.isConnected;
    if (current.mounted) {
      const mounted = current.value as T;
      queueHook(element, () => directive.mounted?.(element, mounted));
    } else {
      queueHook(element, () => directive.unmounted?.(element), true);
    }
  };
  let state = elements.get(element);
  if (state) {
    state.runs += 1;
    if (!Object.is(value, state.value)) {
      const previous = state.value as T;
      state.value = value;
      if (state.mounted) queueHook(element, () => directive.updated?.(element, value, previous));
    }
  } else {
    state = { value, mounted: false, runs: 0, unwatch: watchDocument(sync) };
    elements.set(element, state);
  }
  sync();
  const taken = state;
  const runs = taken.runs;
  return () => {
    queueMicrotask(() => {
      if (elements.get(element) !== taken || taken.runs !== runs) return;
      taken.unwatch();
      elements.delete(element);
      if (taken.mounted) queueHook(element, () => directive.unmounted?.(element), true);
    });
  };
}

/**
 * Runs a directive's hook once the turn ends, as Vue runs them: the elements that leave first,
 * then a descendant's before its ancestor's and siblings' in document order, one element's in
 * the order they came, with the hooks every other output queued.
 */
function queueHook(element: Element, run: () => void, leaving = false): void {
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
    // An element whose first hook of the turn is `unmounted` leaves before any other mounts.
    const leaves = new Map<Element, boolean>();
    for (const hook of hooks) {
      if (!leaves.has(hook.element)) leaves.set(hook.element, hook.leaving);
    }
    hooks.sort((a, b) => {
      if (a.element === b.element) return 0;
      const leaving = leaves.get(a.element) === true;
      if (leaving !== (leaves.get(b.element) === true)) return leaving ? -1 : 1;
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

@Directive({ selector: "[vFocusTrap]" })
export class VFocusTrap {
  readonly vFocusTrap = input.required<boolean>();
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
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
    const element = this.element.nativeElement;
    let stop: (() => void) | undefined;
    afterRenderEffect(() => {
      stop = runDirective(hooks, element, this.vFocusTrap());
    });
    inject(DestroyRef).onDestroy(() => stop?.());
  }
}
