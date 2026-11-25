import { queueHook as queueHook_1 } from "./_unframework/queueHook";
import { DestroyRef, Directive, ElementRef, afterRenderEffect, inject, input } from "@angular/core";

type Field = HTMLInputElement | HTMLTextAreaElement;

const untrack = "data-untrack";
const onMount = "mounted";
const queueHook = "data-queue";
const ObjectDirective = "queued";

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
 * Each directive's elements: the value each last received, whether `mounted` ran, whether it
 * left its caller's list, how many runs took it up, and the end of its watch on the document.
 */
const directiveStates = new WeakMap<
  object,
  WeakMap<
    Element,
    { value: unknown; mounted: boolean; left: boolean; runs: number; unwatch: () => void }
  >
>();

/**
 * The check of a directive's elements: `mounted` once an element is in the document, and
 * `unmounted` once it leaves. A caller that lists its elements passes `follow`, which takes an
 * element out of the list as it leaves and back in if it returns, for the caller's next run to
 * mount it with the value of then; meanwhile the element belongs to a weak watch alone
 * (`watchLeft`). Declared apart from `runDirective`, whose scope holds
 * the element, so nothing it makes keeps a left element alive.
 */
function directiveCheck<E extends Element, T>(
  directive: DirectiveHooks<E, T>,
  elements: WeakMap<
    Element,
    { value: unknown; mounted: boolean; left: boolean; runs: number; unwatch: () => void }
  >,
  follow: { leave(element: E): void; back(element: E): void } | undefined,
): (target: E) => void {
  const check = (target: E): void => {
    const current = elements.get(target);
    if (!current || current.mounted === target.isConnected) return;
    if (current.left) {
      // Back in the document, it rejoins the list, and the caller's next run mounts it with the
      // value of then.
      if (target.isConnected) follow?.back(target);
      return;
    }
    current.mounted = target.isConnected;
    if (current.mounted) {
      const mounted = current.value as T;
      queueHook_1(target, () => directive.mounted?.(target, mounted), "mounted");
      return;
    }
    queueHook_1(target, () => directive.unmounted?.(target), "unmounted");
    if (!follow) return;
    current.left = true;
    current.unwatch();
    current.unwatch = watchLeft(target, check);
    follow.leave(target);
  };
  return check;
}

/**
 * Watches an element that left its caller's list through a `WeakRef`: `check` runs on it
 * after each change of the document while it lives, and the watch ends once it is collected.
 */
function watchLeft<E extends Element>(element: E, check: (target: E) => void): () => void {
  const left = new WeakRef(element);
  const unwatch = watchDocument(() => {
    const kept = left.deref();
    if (kept) check(kept);
    else unwatch();
  });
  return unwatch;
}

/**
 * Runs a directive's hooks on its element: `mounted` once the element is in the document,
 * `updated` for a value that changed while it is, and `unmounted` once it leaves, which
 * projected content may do and come back. A caller that lists its elements passes `follow`
 * (`directiveCheck`): an element that left the list stays with its weak watch, and one that is gone
 * for good is collected, which ends its watch at the next change of the document. The stop it
 * returns, called when the element's owner goes, unmounts the element a microtask later, unless a
 * later run took it up or it left a list.
 */
function runDirective<E extends Element, T>(
  directive: DirectiveHooks<E, T>,
  element: E,
  value: T,
  follow?: { leave(element: E): void; back(element: E): void },
): () => void {
  let own = directiveStates.get(directive);
  if (!own) {
    own = new WeakMap();
    directiveStates.set(directive, own);
  }
  const elements = own;
  const check = directiveCheck(directive, elements, follow);
  let state = elements.get(element);
  if (state?.left) {
    // A left element its caller lists again: it is followed as any other.
    state.left = false;
    state.unwatch();
    state.unwatch = watchDocument(() => check(element));
  }
  if (state) {
    state.runs += 1;
    if (!Object.is(value, state.value)) {
      const previous = state.value as T;
      state.value = value;
      if (state.mounted) {
        queueHook_1(element, () => directive.updated?.(element, value, previous), "updated");
      }
    }
  } else {
    state = {
      value,
      mounted: false,
      left: false,
      runs: 0,
      unwatch: watchDocument(() => check(element)),
    };
    elements.set(element, state);
  }
  check(element);
  const taken = state;
  const runs = taken.runs;
  return () => {
    queueMicrotask(() => {
      if (elements.get(element) !== taken || taken.runs !== runs || taken.left) return;
      taken.unwatch();
      elements.delete(element);
      if (taken.mounted) queueHook_1(element, () => directive.unmounted?.(element), "unmounted");
    });
  };
}

@Directive({ selector: "[vSelectable]" })
export class VSelectable {
  readonly vSelectable = input.required<boolean>();
  private readonly element = inject<ElementRef<Field>>(ElementRef);

  constructor() {
    const hooks = {
      mounted(el: Field, value: boolean) {
        el.setAttribute("data-selectable", String(value));
        el.setAttribute(untrack, onMount);
        el.setAttribute(queueHook, ObjectDirective);
      },
    };
    const element = this.element.nativeElement;
    let stop: (() => void) | undefined;
    afterRenderEffect(() => {
      stop = runDirective(hooks, element, this.vSelectable());
    });
    inject(DestroyRef).onDestroy(() => stop?.());
  }
}
