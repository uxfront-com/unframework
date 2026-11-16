import Note from "./Note";
import {
  type CSSProperties,
  type ClassList,
  type Signal,
  component$,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";

const TRACE = "directive-trace";

const vTrace = {
  mounted(el: HTMLElement, value: string) {
    document.dispatchEvent(new CustomEvent(TRACE, { detail: { call: `mounted ${value}`, el } }));
  },
  unmounted(el: HTMLElement) {
    const call = `unmounted ${el.getAttribute("data-name")}`;
    document.dispatchEvent(new CustomEvent(TRACE, { detail: { call, el } }));
  },
};

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const shown = useSignal(true);

    const traceElements = useSignal<DirectiveElement<typeof vTrace>[]>([]);

    useVisibleTask$(
      ({ track, cleanup }) => {
        const value = "outer";
        for (const element of track(traceElements)) {
          cleanup(
            runDirective(vTrace, element, value, {
              leave: (left) => forgetElement(traceElements, left),
              back: (kept) => collectElement(traceElements, kept),
            }),
          );
        }
      },
      { strategy: "document-ready" },
    );

    const traceElements_1 = useSignal<DirectiveElement<typeof vTrace>[]>([]);

    useVisibleTask$(
      ({ track, cleanup }) => {
        const value = "first";
        for (const element of track(traceElements_1)) {
          cleanup(
            runDirective(vTrace, element, value, {
              leave: (left) => forgetElement(traceElements_1, left),
              back: (kept) => collectElement(traceElements_1, kept),
            }),
          );
        }
      },
      { strategy: "document-ready" },
    );

    const traceElements_2 = useSignal<DirectiveElement<typeof vTrace>[]>([]);

    useVisibleTask$(
      ({ track, cleanup }) => {
        const value = "branch";
        for (const element of track(traceElements_2)) {
          cleanup(
            runDirective(vTrace, element, value, {
              leave: (left) => forgetElement(traceElements_2, left),
              back: (kept) => collectElement(traceElements_2, kept),
            }),
          );
        }
      },
      { strategy: "document-ready" },
    );

    const traceElements_3 = useSignal<DirectiveElement<typeof vTrace>[]>([]);

    useVisibleTask$(
      ({ track, cleanup }) => {
        const value = "leaf";
        for (const element of track(traceElements_3)) {
          cleanup(
            runDirective(vTrace, element, value, {
              leave: (left) => forgetElement(traceElements_3, left),
              back: (kept) => collectElement(traceElements_3, kept),
            }),
          );
        }
      },
      { strategy: "document-ready" },
    );

    const traceElements_4 = useSignal<DirectiveElement<typeof vTrace>[]>([]);

    useVisibleTask$(
      ({ track, cleanup }) => {
        const value = "placeholder";
        for (const element of track(traceElements_4)) {
          cleanup(
            runDirective(vTrace, element, value, {
              leave: (left) => forgetElement(traceElements_4, left),
              back: (kept) => collectElement(traceElements_4, kept),
            }),
          );
        }
      },
      { strategy: "document-ready" },
    );

    const traceElements_5 = useSignal<DirectiveElement<typeof vTrace>[]>([]);

    useVisibleTask$(
      ({ track, cleanup }) => {
        const value = "last";
        for (const element of track(traceElements_5)) {
          cleanup(
            runDirective(vTrace, element, value, {
              leave: (left) => forgetElement(traceElements_5, left),
              back: (kept) => collectElement(traceElements_5, kept),
            }),
          );
        }
      },
      { strategy: "document-ready" },
    );

    return (
      <section
        class={["tree", className]}
        aria-label="Tree"
        data-name="outer"
        ref={(element) => collectElement(traceElements, element)}
        {...scopeAttributes(attributes)}
        style={style}
      >
        <p data-name="first" ref={(element) => collectElement(traceElements_1, element)}>
          First
        </p>
        <Note />
        <>
          {shown.value ? (
            <div
              class="branch"
              data-name="branch"
              ref={(element) => collectElement(traceElements_2, element)}
            >
              <span data-name="leaf" ref={(element) => collectElement(traceElements_3, element)}>
                Leaf
              </span>
            </div>
          ) : (
            <p data-name="placeholder" ref={(element) => collectElement(traceElements_4, element)}>
              Placeholder
            </p>
          )}
        </>
        <p data-name="last" ref={(element) => collectElement(traceElements_5, element)}>
          Last
        </p>
        <button type="button" onClick$={() => (shown.value = !shown.value)}>
          Toggle
        </button>
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
 * Runs a directive's hooks on its element: `mounted` once the element is in the document,
 * `updated` for a value that changed while it is, and `unmounted` once it leaves, which
 * projected content may do and come back. A caller that lists its elements passes `follow`,
 * which takes an element out of the list as it leaves and back in if it returns: meanwhile the
 * watch holds it weakly, so an element that is gone for good is collected, and its watch ends at
 * the next change of the document. The stop it returns, called when the element's owner goes,
 * unmounts the element a microtask later, unless a later run took it up.
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
  const check = (target: E): void => {
    const current = elements.get(target);
    if (!current || current.mounted === target.isConnected) return;
    current.mounted = target.isConnected;
    if (current.mounted) {
      const mounted = current.value as T;
      queueHook(target, () => directive.mounted?.(target, mounted), "mounted");
      if (!follow || !current.left) return;
      current.left = false;
      current.unwatch();
      current.unwatch = watchDocument(() => check(target));
      follow.back(target);
      return;
    }
    queueHook(target, () => directive.unmounted?.(target), "unmounted");
    if (!follow) return;
    current.left = true;
    current.unwatch();
    const left = new WeakRef(target);
    const unwatch = watchDocument(() => {
      const kept = left.deref();
      if (kept) check(kept);
      else unwatch();
    });
    current.unwatch = unwatch;
    follow.leave(target);
  };
  let state = elements.get(element);
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
      if (elements.get(element) !== taken || taken.runs !== runs) return;
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
