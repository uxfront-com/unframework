import Disclosure from "./Disclosure";
import {
  type CSSProperties,
  type ClassList,
  component$,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";

const vTrace = {
  mounted(el: HTMLElement, value: string) {
    const call = `mounted ${value}`;
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
  unmounted(el: HTMLElement) {
    const call = `unmounted ${el.getAttribute("data-name")}`;
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
};

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const note = useSignal<{ name: string } | null>({ name: "note" });

    const traceElement = useSignal<DirectiveElement<typeof vTrace>>();

    useVisibleTask$(
      ({ track, cleanup }) => {
        const element = track(traceElement);
        if (element) cleanup(runDirective(vTrace, element, "body"));
      },
      { strategy: "document-ready" },
    );

    const traceElement_1 = useSignal<DirectiveElement<typeof vTrace>>();

    useVisibleTask$(
      ({ track, cleanup }) => {
        const element = track(traceElement_1);
        if (element?.isConnected)
          cleanup(
            runDirective(
              vTrace,
              element,
              track(() => note.value!.name),
            ),
          );
        else if (element) cleanup(waitForDocument(element, () => traceElement_1.trigger()));
      },
      { strategy: "document-ready" },
    );

    return (
      <section
        class={["card", className]}
        aria-label="Card"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <Disclosure>
          <p data-name="body" ref={traceElement}>
            Body
          </p>
          {note.value ? (
            <p data-name="note" ref={traceElement_1}>
              Note
            </p>
          ) : null}
        </Disclosure>
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

/** Calls `ready` once `element` is in the document, and returns the end of the wait. */
function waitForDocument(element: Element, ready: () => void): () => void {
  const unwatch = watchDocument(() => {
    if (!element.isConnected) return;
    unwatch();
    ready();
  });
  return unwatch;
}

/** The element a directive's hooks take. */
type DirectiveElement<D> = D extends DirectiveHooks<infer E extends Element, never> ? E : never;

/**
 * Runs a directive's hook once the turn ends, as Vue runs them: every `unmounted` first, then
 * a descendant's before its ancestor's and siblings' in document order, one element's in the
 * order they came, with the hooks every other output queued.
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
    // Every `unmounted` runs first, but one after its own element's `mounted` this turn, as
    // StrictMode's, which keeps its place among the rest.
    const first = new Set<{ element: Element; run: () => void; leaving: boolean }>();
    const entered = new Set<Element>();
    for (const hook of hooks) {
      if (!hook.leaving) entered.add(hook.element);
      else if (!entered.has(hook.element)) first.add(hook);
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
    for (const hook of hooks) {
      try {
        hook.run();
      } catch (error) {
        reportError(error);
      }
    }
  });
}
