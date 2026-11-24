import { queueHook } from "./_unframework/queueHook";
import {
  type TransitionState,
  runTransition,
  stopTransition,
  transition,
} from "./_unframework/transition";
import { vMark } from "./vMark";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type Signal,
  component$,
  useConstant,
  useSignal,
  useStyles$,
  useVisibleTask$,
} from "@qwik.dev/core";
import styles from "./Banner.uf.tsx.css?inline";

export default component$<
  Omit<PropsOf<"section">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  useStyles$(styles);

  const shown = useSignal(true);

  const fadeState = useConstant((): TransitionState => ({
    current: shown.value ? 0 : -1,
    elements: [],
    entering: [],
  }));
  const fadeShown = useSignal<number[]>([shown.value ? 0 : -1].filter((index) => index >= 0));
  useVisibleTask$(
    ({ track }) => {
      const next = track(() => (shown.value ? 0 : -1));
      const previous = fadeState.current;
      if (next === previous) return;
      fadeState.current = next;
      if (next >= 0) {
        // Shown again while it leaves: its leave stops, and it stays as it is.
        stopTransition(fadeState.elements[next]);
        if (!fadeShown.value.includes(next)) {
          fadeState.entering.push(next);
          fadeShown.value = [...fadeShown.value, next];
          // Qwik renders the branch within the frame, unless a condition around the transition
          // hides it: then the mark goes, so the element it shows later enters only with appear.
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              const left = fadeState.entering.indexOf(next);
              if (left >= 0) fadeState.entering.splice(left, 1);
            }),
          );
        }
      }
      const leaving = previous < 0 ? undefined : fadeState.elements[previous];
      if (!leaving) {
        fadeShown.value = fadeShown.value.filter((index) => index !== previous);
        return;
      }
      runTransition(leaving, "fade", "leave", () => {
        if (fadeState.current !== previous)
          fadeShown.value = fadeShown.value.filter((index) => index !== previous);
      });
    },
    { strategy: "document-ready" },
  );

  const markElements = useSignal<DirectiveElement<typeof vMark>[]>([]);

  useVisibleTask$(
    ({ track, cleanup }) => {
      const value = "banner";
      for (const element of track(markElements)) {
        cleanup(
          runDirective(vMark, element, value, {
            leave: (left) => forgetElement(markElements, left),
            back: (kept) => collectElement(markElements, kept),
          }),
        );
      }
    },
    { strategy: "document-ready" },
  );

  return (
    <section aria-label="News" data-uf-53025c4a="" class={className} style={style} {...attributes}>
      <button type="button" onClick$={() => (shown.value = false)} data-uf-53025c4a="">
        Dismiss
      </button>
      <>
        {fadeShown.value.includes(0) && (
          <p
            class="banner"
            ref={transition(fadeState, "fade", 0, false, (element) =>
              collectElement(markElements, element),
            )}
            data-uf-53025c4a=""
          >
            New releases are out.
          </p>
        )}
      </>
    </section>
  );
});

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
      queueHook(target, () => directive.mounted?.(target, mounted), "mounted");
      return;
    }
    queueHook(target, () => directive.unmounted?.(target), "unmounted");
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
        queueHook(element, () => directive.updated?.(element, value, previous), "updated");
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
      if (taken.mounted) queueHook(element, () => directive.unmounted?.(element), "unmounted");
    });
  };
}

/**
 * Adds an element a directive's `ref` receives to the directive's elements, once: on the server
 * a reference the client resumes as the element, so every element one use renders is followed.
 */
function collectElement<E extends Element>(elements: Signal<E[]>, element: E): void {
  if (elements.untrackedValue.includes(element)) return;
  elements.value = [...elements.untrackedValue, element];
}

/**
 * Drops an element that left the document from its directive's elements, once `unmounted` ran,
 * so the list holds only the elements in it; one Qwik projects again comes back through the
 * runner's weak watch.
 */
function forgetElement<E extends Element>(elements: Signal<E[]>, element: E): void {
  elements.untrackedValue = elements.untrackedValue.filter((each) => each !== element);
}

/** The element a directive's hooks take. */
type DirectiveElement<D> = D extends DirectiveHooks<infer E extends Element, never> ? E : never;
