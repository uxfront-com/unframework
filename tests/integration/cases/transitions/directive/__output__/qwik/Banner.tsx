import { vMark } from "./vMark";
import {
  type CSSProperties,
  type ClassList,
  type Signal,
  component$,
  useConstant,
  useSignal,
  useStyles$,
  useVisibleTask$,
} from "@qwik.dev/core";
import { isServer } from "@qwik.dev/core/build";
import styles from "./Banner.uf.tsx.css?inline";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
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
      <section
        aria-label="News"
        data-uf-53025c4a=""
        {...scopeAttributes(attributes)}
        class={className}
        style={style}
      >
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
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}

/**
 * A transition's state: the branch shown, each branch's element, and the branches a change of the
 * branch shown adds, which enter. Qwik serialises it, so it holds no function.
 */
interface TransitionState {
  current: number;
  elements: Element[];
  entering: number[];
}

/** What stops the phase each element runs now, which its next phase stops first. */
const transitionStops = new WeakMap<Element, () => void>();

/** Stops the phase an element runs, if any, with its classes and without its `done`. */
function stopTransition(element: Element | undefined): void {
  if (element) transitionStops.get(element)?.();
}

/**
 * Runs Vue's transition classes of `name` of one phase on `element`, then `done`: `-from` and
 * `-active`, `-to` for `-from` two frames later, and none once the element's own
 * `transitionend` or `animationend` fires, or its longest duration and delay pass. A phase the
 * element still runs stops first.
 */
function runTransition(
  element: Element,
  name: string,
  phase: "enter" | "leave",
  done?: () => void,
): void {
  transitionStops.get(element)?.();
  const from = `${name}-${phase}-from`;
  const active = `${name}-${phase}-active`;
  const to = `${name}-${phase}-to`;
  let frame = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    element.removeEventListener("transitionend", end);
    element.removeEventListener("animationend", end);
    element.classList.remove(from, active, to);
    if (transitionStops.get(element) === stop) transitionStops.delete(element);
  };
  transitionStops.set(element, stop);
  const end = (event?: Event) => {
    if (event && event.target !== element) return;
    stop();
    done?.();
  };
  element.classList.add(from, active);
  frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(() => {
      element.classList.remove(from);
      element.classList.add(to);
      const style = getComputedStyle(element);
      const longest = (delays: string, durations: string) => {
        const each = (list: string) =>
          list.split(", ").map((time) => Number(time.slice(0, -1)) * 1000);
        const delay = each(delays);
        return Math.max(
          0,
          ...each(durations).map(
            (duration, index) => duration + (delay[index % delay.length] ?? 0),
          ),
        );
      };
      const time = Math.max(
        longest(style.transitionDelay, style.transitionDuration),
        longest(style.animationDelay, style.animationDuration),
      );
      if (!time) {
        end();
        return;
      }
      element.addEventListener("transitionend", end);
      element.addEventListener("animationend", end);
      timer = setTimeout(end, time + 1);
    });
  });
}

/**
 * The ref of a transition's element: it records the element, and runs its enter when a change of
 * the branch shown added it, or with `appear`, as the transition first mounts. An element that
 * a condition around the transition shows again enters only with `appear`, as on Vue. Qwik calls
 * a ref again when its value changes, and each render makes a new one, so it takes an element
 * once. It calls the element's own ref first.
 */
function transition(
  state: TransitionState,
  name: string,
  index: number,
  appear: boolean,
  own?: ((element: Element) => void) | { value: Element | undefined },
): (element: Element) => void {
  return (element) => {
    if (typeof own === "function") own(element);
    else if (own) own.value = element;
    // Qwik's server render calls a ref too, with no DOM: the server renders the settled child.
    if (isServer) return;
    if (state.elements[index] === element) return;
    state.elements[index] = element;
    const entering = state.entering.indexOf(index);
    if (entering >= 0) state.entering.splice(entering, 1);
    if (entering >= 0 || appear) runTransition(element, name, "enter");
  };
}

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

/**
 * Runs a directive's hook once the turn ends, as Vue runs them: every `unmounted` first, then
 * a descendant's before its ancestor's and siblings' in document order, one element's in the
 * order they came, with the hooks every other output queued.
 */
function queueHook(
  element: Element,
  run: () => void,
  hook: "mounted" | "updated" | "unmounted",
): void {
  const key: unique symbol = Symbol.for("unframework.directive-hooks@2");
  const scope = globalThis as typeof globalThis & {
    [key]?: { element: Element; run: () => void; hook: "mounted" | "updated" | "unmounted" }[];
  };
  const queued = scope[key];
  if (queued) {
    queued.push({ element, run, hook });
    return;
  }
  scope[key] = [{ element, run, hook }];
  queueMicrotask(() => {
    const hooks = scope[key] ?? [];
    scope[key] = undefined;
    // Every `unmounted` runs first, but one after its own element's `mounted` this turn, as
    // StrictMode's, which keeps its place among the rest. A leaving one moves up together
    // with the element's hooks before it, which keep their order.
    const first = new Set<(typeof hooks)[number]>();
    const entered = new Set<Element>();
    for (const each of hooks) {
      if (each.hook === "mounted") entered.add(each.element);
      if (each.hook !== "unmounted" || entered.has(each.element)) continue;
      for (const earlier of hooks) {
        if (earlier.element === each.element) first.add(earlier);
        if (earlier === each) break;
      }
    }
    hooks.sort((a, b) => {
      if (first.has(a) !== first.has(b)) return first.has(a) ? -1 : 1;
      if (a.element === b.element) return 0;
      if (a.element.contains(b.element)) return 1;
      if (b.element.contains(a.element)) return -1;
      return a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING
        ? -1
        : 1;
    });
    for (const each of hooks) {
      try {
        each.run();
      } catch (error) {
        reportError(error);
      }
    }
  });
}
