import Picker from "./Picker";
import { vMark } from "./vMark";
import { vTrace } from "./vTrace";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type Signal,
  component$,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"section">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const items = useSignal<{ id: string; label: string; note?: string }[]>([
    { id: "a", label: "Alpha", note: "First" },
    { id: "b", label: "Beta" },
    { id: "c", label: "Gamma" },
  ]);
  const prefix = useSignal("Open");
  const focused = useSignal(0);

  const traceElements = useSignal<
    { element: DirectiveElement<typeof vTrace>; values: [DirectiveValue<typeof vTrace>] }[]
  >([]);

  useVisibleTask$(
    ({ track, cleanup }) => {
      for (const { element, values } of track(traceElements)) {
        cleanup(
          runDirective(vTrace, element, values[0], {
            leave: (left) => forgetValues(traceElements, left),
            back: collectValues(traceElements, values),
          }),
        );
      }
    },
    { strategy: "document-ready" },
  );

  const traceElements_1 = useSignal<
    { element: DirectiveElement<typeof vTrace>; values: [DirectiveValue<typeof vTrace>] }[]
  >([]);

  useVisibleTask$(
    ({ track, cleanup }) => {
      for (const { element, values } of track(traceElements_1)) {
        cleanup(
          runDirective(vTrace, element, values[0], {
            leave: (left) => forgetValues(traceElements_1, left),
            back: collectValues(traceElements_1, values),
          }),
        );
      }
    },
    { strategy: "document-ready" },
  );

  const traceElements_2 = useSignal<
    {
      element: DirectiveElement<typeof vTrace>;
      values: [DirectiveValue<typeof vTrace>, DirectiveValue<typeof vMark>];
    }[]
  >([]);

  useVisibleTask$(
    ({ track, cleanup }) => {
      for (const { element, values } of track(traceElements_2)) {
        cleanup(
          runDirective(vTrace, element, values[0], {
            leave: (left) => forgetValues(traceElements_2, left),
            back: collectValues(traceElements_2, values),
          }),
        );
      }
    },
    { strategy: "document-ready" },
  );

  useVisibleTask$(
    ({ track, cleanup }) => {
      for (const { element, values } of track(traceElements_2)) {
        cleanup(
          runDirective(vMark, element, values[1], {
            leave: (left) => forgetValues(traceElements_2, left),
            back: collectValues(traceElements_2, values),
          }),
        );
      }
    },
    { strategy: "document-ready" },
  );

  const traceElements_3 = useSignal<
    { element: DirectiveElement<typeof vTrace>; values: [DirectiveValue<typeof vTrace>] }[]
  >([]);

  useVisibleTask$(
    ({ track, cleanup }) => {
      for (const { element, values } of track(traceElements_3)) {
        cleanup(
          runDirective(vTrace, element, values[0], {
            leave: (left) => forgetValues(traceElements_3, left),
            back: collectValues(traceElements_3, values),
          }),
        );
      }
    },
    { strategy: "document-ready" },
  );

  const traceElements_4 = useSignal<
    { element: DirectiveElement<typeof vTrace>; values: [DirectiveValue<typeof vTrace>] }[]
  >([]);

  useVisibleTask$(
    ({ track, cleanup }) => {
      for (const { element, values } of track(traceElements_4)) {
        cleanup(
          runDirective(vTrace, element, values[0], {
            leave: (left) => forgetValues(traceElements_4, left),
            back: collectValues(traceElements_4, values),
          }),
        );
      }
    },
    { strategy: "document-ready" },
  );

  const traceElements_5 = useSignal<
    { element: DirectiveElement<typeof vTrace>; values: [DirectiveValue<typeof vTrace>] }[]
  >([]);

  useVisibleTask$(
    ({ track, cleanup }) => {
      for (const { element, values } of track(traceElements_5)) {
        cleanup(
          runDirective(vTrace, element, values[0], {
            leave: (left) => forgetValues(traceElements_5, left),
            back: collectValues(traceElements_5, values),
          }),
        );
      }
    },
    { strategy: "document-ready" },
  );

  return (
    <section class={["menu", className]} aria-label="Menu" style={style} {...attributes}>
      <ul aria-label="Items">
        {items.value.map((item) => (
          <li key={item.id} data-name={item.id} ref={collectValues(traceElements, [item.label])}>
            {item.label}
            {item.note ? (
              <b data-name={`note-${item.id}`} ref={collectValues(traceElements_1, [item.note])}>
                {item.note}
              </b>
            ) : null}
          </li>
        ))}
      </ul>
      <ul aria-label="Marked">
        {items.value.map((item) => (
          <li
            key={item.id}
            data-name={`both-${item.id}`}
            ref={collectValues(traceElements_2, [item.label, item.id])}
          >
            {item.label}
          </li>
        ))}
      </ul>
      <div class="focus">
        {items.value.map((item) => (
          <button
            key={item.id}
            type="button"
            data-name={`focus-${item.id}`}
            onFocusIn$={() => focused.value++}
            ref={collectValues(traceElements_3, [item.label])}
          >
            Focus {item.label}
          </button>
        ))}
      </div>
      <output>{focused.value}</output>
      <ul aria-label="Prefixed">
        {items.value.map((item) => (
          <li
            key={item.id}
            data-name={`prefixed-${item.id}`}
            ref={collectValues(traceElements_4, [`${prefix.value} ${item.label}`])}
          >
            {item.label}
          </li>
        ))}
      </ul>
      <Picker
        option$={({ option }) => (
          <span
            data-name={`option-${option.id}`}
            ref={collectValues(traceElements_5, [`${prefix.value} ${option.label}`])}
          >
            {option.label}
          </span>
        )}
      />
      <button
        type="button"
        onClick$={() =>
          (items.value = items.value.map((item) =>
            item.id === "a" ? { id: "a", label: "Alpha 2", note: "First" } : item,
          ))
        }
      >
        Rename first
      </button>
      <button type="button" onClick$={() => (items.value = [...items.value].reverse())}>
        Reverse
      </button>
      <button
        type="button"
        onClick$={() => (items.value = items.value.filter((item) => item.id !== "b"))}
      >
        Remove second
      </button>
      <button
        type="button"
        onClick$={() => (items.value = [...items.value, { id: "d", label: "Delta" }])}
      >
        Add item
      </button>
      <button type="button" onClick$={() => (prefix.value = "Close")}>
        Change prefix
      </button>
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
 * The `ref` of an element whose directives' values read its row or its slot's props: it adds the
 * element to its directives' elements with the values, read as the element renders, or gives it
 * the values of this render where one changed (`Object.is`), so the tasks run it again. A
 * function `ref` is new at each render, and Qwik calls the new one with the element. `then`
 * fills the element's template ref too.
 */
function collectValues<E extends Element, V extends unknown[]>(
  elements: Signal<{ element: E; values: V }[]>,
  values: NoInfer<V>,
  then?: (element: E) => void,
): (element: E) => void {
  return (element) => {
    then?.(element);
    const listed = elements.untrackedValue;
    const found = listed.find((each) => each.element === element);
    if (found?.values.every((value, index) => Object.is(value, values[index]))) return;
    elements.value = found
      ? listed.map((each) => (each === found ? { element, values } : each))
      : [...listed, { element, values }];
  };
}

/**
 * Drops an element that left the document from its directives' elements, once `unmounted` ran;
 * one Qwik projects again comes back with the values it last had, through the runner's weak watch.
 */
function forgetValues<E extends Element, V>(
  elements: Signal<{ element: E; values: V }[]>,
  element: E,
): void {
  elements.untrackedValue = elements.untrackedValue.filter((each) => each.element !== element);
}

/** The value a directive's hooks take. */
type DirectiveValue<D> = D extends DirectiveHooks<never, infer T> ? T : never;

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
