import Disclosure from "./Disclosure";
import {
  type CSSProperties,
  type ClassList,
  type Signal,
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

    const traceElements = useSignal<DirectiveElement<typeof vTrace>[]>([]);

    useVisibleTask$(
      ({ track, cleanup }) => {
        const value = "body";
        for (const element of track(traceElements)) {
          cleanup(runDirective(vTrace, element, value));
        }
      },
      { strategy: "document-ready" },
    );

    const traceElements_1 = useSignal<DirectiveElement<typeof vTrace>[]>([]);

    useVisibleTask$(
      ({ track, cleanup }) => {
        if (track(traceElements_1).some((element) => element.isConnected)) {
          const value = track(() => note.value!.name);
          for (const element of track(traceElements_1)) {
            cleanup(runDirective(vTrace, element, value));
          }
        } else {
          for (const element of traceElements_1.value) {
            cleanup(waitForDocument(element, () => traceElements_1.trigger()));
          }
        }
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
          <p data-name="body" ref={(element) => collectElement(traceElements, element)}>
            Body
          </p>
          {note.value ? (
            <p data-name="note" ref={(element) => collectElement(traceElements_1, element)}>
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
      queueHook(element, () => directive.mounted?.(element, mounted), "mounted");
    } else {
      queueHook(element, () => directive.unmounted?.(element), "unmounted");
    }
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
      if (taken.mounted) queueHook(element, () => directive.unmounted?.(element), "unmounted");
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

/**
 * Adds an element a directive's `ref` receives to the directive's elements, once: on the server
 * a reference the client resumes as the element, so every element one use renders is followed.
 */
function collectElement<E extends Element>(elements: Signal<E[]>, element: E): void {
  if (elements.untrackedValue.includes(element)) return;
  elements.value = [...elements.untrackedValue, element];
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
