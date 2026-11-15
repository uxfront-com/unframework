import Note from "./Note";
import {
  type CSSProperties,
  type ClassList,
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

    const traceElement = useSignal<DirectiveElement<typeof vTrace>>();

    useVisibleTask$(
      ({ track, cleanup }) => {
        const element = track(traceElement);
        if (element) cleanup(runDirective(vTrace, element, "outer"));
      },
      { strategy: "document-ready" },
    );

    const traceElement_1 = useSignal<DirectiveElement<typeof vTrace>>();

    useVisibleTask$(
      ({ track, cleanup }) => {
        const element = track(traceElement_1);
        if (element) cleanup(runDirective(vTrace, element, "first"));
      },
      { strategy: "document-ready" },
    );

    const traceElement_2 = useSignal<DirectiveElement<typeof vTrace>>();

    useVisibleTask$(
      ({ track, cleanup }) => {
        const element = track(traceElement_2);
        if (element) cleanup(runDirective(vTrace, element, "branch"));
      },
      { strategy: "document-ready" },
    );

    const traceElement_3 = useSignal<DirectiveElement<typeof vTrace>>();

    useVisibleTask$(
      ({ track, cleanup }) => {
        const element = track(traceElement_3);
        if (element) cleanup(runDirective(vTrace, element, "leaf"));
      },
      { strategy: "document-ready" },
    );

    const traceElement_4 = useSignal<DirectiveElement<typeof vTrace>>();

    useVisibleTask$(
      ({ track, cleanup }) => {
        const element = track(traceElement_4);
        if (element) cleanup(runDirective(vTrace, element, "placeholder"));
      },
      { strategy: "document-ready" },
    );

    const traceElement_5 = useSignal<DirectiveElement<typeof vTrace>>();

    useVisibleTask$(
      ({ track, cleanup }) => {
        const element = track(traceElement_5);
        if (element) cleanup(runDirective(vTrace, element, "last"));
      },
      { strategy: "document-ready" },
    );

    return (
      <section
        class={["tree", className]}
        aria-label="Tree"
        data-name="outer"
        ref={traceElement}
        {...scopeAttributes(attributes)}
        style={style}
      >
        <p data-name="first" ref={traceElement_1}>
          First
        </p>
        <Note />
        <>
          {shown.value ? (
            <div class="branch" data-name="branch" ref={traceElement_2}>
              <span data-name="leaf" ref={traceElement_3}>
                Leaf
              </span>
            </div>
          ) : (
            <p data-name="placeholder" ref={traceElement_4}>
              Placeholder
            </p>
          )}
        </>
        <p data-name="last" ref={traceElement_5}>
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

/** The element a directive's hooks take. */
type DirectiveElement<D> = D extends DirectiveHooks<infer E extends Element, never> ? E : never;

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
