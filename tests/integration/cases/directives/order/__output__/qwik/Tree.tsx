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
        if (element?.isConnected) runDirective(vTrace, element, "outer", cleanup);
      },
      { strategy: "document-ready" },
    );

    const traceElement_1 = useSignal<DirectiveElement<typeof vTrace>>();

    useVisibleTask$(
      ({ track, cleanup }) => {
        const element = track(traceElement_1);
        if (element?.isConnected) runDirective(vTrace, element, "first", cleanup);
      },
      { strategy: "document-ready" },
    );

    const traceElement_2 = useSignal<DirectiveElement<typeof vTrace>>();

    useVisibleTask$(
      ({ track, cleanup }) => {
        const element = track(traceElement_2);
        if (element?.isConnected) runDirective(vTrace, element, "branch", cleanup);
      },
      { strategy: "document-ready" },
    );

    const traceElement_3 = useSignal<DirectiveElement<typeof vTrace>>();

    useVisibleTask$(
      ({ track, cleanup }) => {
        const element = track(traceElement_3);
        if (element?.isConnected) runDirective(vTrace, element, "leaf", cleanup);
      },
      { strategy: "document-ready" },
    );

    const traceElement_4 = useSignal<DirectiveElement<typeof vTrace>>();

    useVisibleTask$(
      ({ track, cleanup }) => {
        const element = track(traceElement_4);
        if (element?.isConnected) runDirective(vTrace, element, "last", cleanup);
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
          ) : null}
        </>
        <p data-name="last" ref={traceElement_4}>
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

/** The value each directive's element last received, and the watch on its removal. */
const directiveStates = new WeakMap<
  object,
  WeakMap<Element, { value: unknown; observer: MutationObserver }>
>();

/**
 * Runs a directive's hooks on its element, from the task that tracks the element and the value:
 * `mounted` for a new element, `updated` for a value that changed, and `unmounted` once the
 * element leaves the document, or the component unmounts.
 */
function runDirective<E extends Element, T>(
  directive: DirectiveHooks<E, T>,
  element: E,
  value: T,
  cleanup: (callback: () => void) => void,
): void {
  let states = directiveStates.get(directive);
  if (!states) {
    states = new WeakMap();
    directiveStates.set(directive, states);
  }
  const own = states;
  const unmount = () => {
    const state = own.get(element);
    if (!state) return;
    state.observer.disconnect();
    own.delete(element);
    queueHook(element, () => directive.unmounted?.(element));
  };
  const state = own.get(element);
  if (!state) {
    const observer = new MutationObserver(() => {
      if (!element.isConnected) unmount();
    });
    observer.observe(document, { childList: true, subtree: true });
    own.set(element, { value, observer });
    queueHook(element, () => directive.mounted?.(element, value));
  } else if (!Object.is(value, state.value)) {
    const previous = state.value as T;
    state.value = value;
    queueHook(element, () => directive.updated?.(element, value, previous));
  }
  cleanup(() => {
    queueMicrotask(() => {
      if (!element.isConnected) unmount();
    });
  });
}

/** The element a directive's hooks take. */
type DirectiveElement<D> = D extends DirectiveHooks<infer E extends Element, never> ? E : never;

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
