import Picker from "./Picker";
import { vMark } from "./vMark";
import { vTrace } from "./vTrace";
import {
  type ComponentPropsWithRef,
  type Ref,
  type RefCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export type MenuAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

export default function Menu({ className, style, ...attributes }: MenuAttributes) {
  const [items, setItems] = useState<{ id: string; label: string; note?: string }[]>([
    { id: "a", label: "Alpha", note: "First" },
    { id: "b", label: "Beta" },
    { id: "c", label: "Gamma" },
  ]);
  const itemsRef = useRef(items);
  const [prefix, setPrefix] = useState("Open");
  const prefixRef = useRef(prefix);
  const [focused, setFocused] = useState(0);
  const focusedRef = useRef(focused);
  const withTrace = useElementDirective(vTrace);
  const withTrace_1 = useElementDirective(vTrace);
  const withTrace_2 = useElementDirective(vTrace);
  const withMark = useElementDirective(vMark);
  const withTrace_3 = useElementDirective(vTrace);
  const withTrace_4 = useElementDirective(vTrace);
  const withTrace_5 = useElementDirective(vTrace);

  return (
    <section className={cx("menu", className)} aria-label="Menu" style={style} {...attributes}>
      <ul aria-label="Items">
        {items.map((item) => (
          <li key={item.id} data-name={item.id} ref={withTrace_1(item.label)}>
            {item.label}
            {item.note ? (
              <b data-name={`note-${item.id}`} ref={withTrace(item.note)}>
                {item.note}
              </b>
            ) : null}
          </li>
        ))}
      </ul>
      <ul aria-label="Marked">
        {items.map((item) => (
          <li
            key={item.id}
            data-name={`both-${item.id}`}
            ref={mergeRefs(withTrace_2(item.label), withMark(item.id))}
          >
            {item.label}
          </li>
        ))}
      </ul>
      <div className="focus">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            data-name={`focus-${item.id}`}
            ref={mergeRefs(withTrace_3(item.label), (element) =>
              listen(element, "focusin", () => {
                focusedRef.current++;
                setFocused(focusedRef.current);
              }),
            )}
          >
            Focus {item.label}
          </button>
        ))}
      </div>
      <output>{focused}</output>
      <ul aria-label="Prefixed">
        {items.map((item) => (
          <li
            key={item.id}
            data-name={`prefixed-${item.id}`}
            ref={withTrace_4(`${prefix} ${item.label}`)}
          >
            {item.label}
          </li>
        ))}
      </ul>
      <Picker
        renderOption={({ option }) => (
          <span data-name={`option-${option.id}`} ref={withTrace_5(`${prefix} ${option.label}`)}>
            {option.label}
          </span>
        )}
      />
      <button
        type="button"
        onClick={() => {
          itemsRef.current = itemsRef.current.map((item) =>
            item.id === "a" ? { id: "a", label: "Alpha 2", note: "First" } : item,
          );
          setItems(itemsRef.current);
        }}
      >
        Rename first
      </button>
      <button
        type="button"
        onClick={() => {
          itemsRef.current = [...itemsRef.current].reverse();
          setItems(itemsRef.current);
        }}
      >
        Reverse
      </button>
      <button
        type="button"
        onClick={() => {
          itemsRef.current = itemsRef.current.filter((item) => item.id !== "b");
          setItems(itemsRef.current);
        }}
      >
        Remove second
      </button>
      <button
        type="button"
        onClick={() => {
          itemsRef.current = [...itemsRef.current, { id: "d", label: "Delta" }];
          setItems(itemsRef.current);
        }}
      >
        Add item
      </button>
      <button
        type="button"
        onClick={() => {
          prefixRef.current = "Close";
          setPrefix(prefixRef.current);
        }}
      >
        Change prefix
      </button>
    </section>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}

/**
 * Listens to a DOM event natively, where React's synthetic event would not keep the DOM's
 * semantics, and gives back what stops it: the cleanup a ref callback returns.
 */
function listen<K extends keyof HTMLElementEventMap>(
  element: EventTarget | null,
  type: K,
  listener: (event: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void {
  element?.addEventListener(type, listener as EventListener, options);
  return () => element?.removeEventListener(type, listener as EventListener, options);
}

/** The hooks of a directive, which `useElementDirective` runs on its elements. */
interface DirectiveHooks<E extends Element, T> {
  mounted?(el: E, value: T): unknown;
  updated?(el: E, value: T, oldValue: T): unknown;
  unmounted?(el: E): unknown;
}

/**
 * Runs a directive's hooks on each element, apart, with the element's own value: a list's rows,
 * or a scoped slot a child calls with other props each time, give each element its own. It
 * returns a function that makes an element's ref callback from its value as the element renders,
 * a new one each render, which records the element with that value, and whose cleanup forgets
 * the element. `mounted` runs once the element is rendered, `updated` after a render that
 * changes its value, and `unmounted` once that element is gone, whichever component renders or
 * removes it.
 */
function useElementDirective<E extends Element, T>(directive: DirectiveHooks<E, T>) {
  const state = useRef<{ attached: Map<E, T>; mounted: Map<E, T> }>({
    attached: new Map(),
    mounted: new Map(),
  });
  const [sync] = useState(() => () => {
    const { attached, mounted } = state.current;
    for (const element of [...mounted.keys()]) {
      if (attached.has(element)) continue;
      mounted.delete(element);
      queueHook(element, () => directive.unmounted?.(element), "unmounted");
    }
    for (const [element, value] of attached) {
      if (!mounted.has(element)) {
        mounted.set(element, value);
        queueHook(element, () => directive.mounted?.(element, value), "mounted");
        continue;
      }
      const previous = mounted.get(element) as T;
      if (Object.is(value, previous)) continue;
      mounted.set(element, value);
      queueHook(element, () => directive.updated?.(element, value, previous), "updated");
    }
  });
  const [withValue] = useState(() => (value: T) => (element: E | null) => {
    if (!element) return () => {};
    state.current.attached.set(element, value);
    queueMicrotask(sync);
    return () => {
      state.current.attached.delete(element);
      queueMicrotask(sync);
    };
  });
  useLayoutEffect(() => {
    sync();
  });
  useLayoutEffect(
    () => () => {
      state.current.attached.clear();
      sync();
    },
    [sync],
  );
  return withValue;
}

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

/** Joins an element's refs into one ref callback, whose cleanup clears each. */
function mergeRefs<E extends Element>(...refs: (Ref<E> | undefined)[]): RefCallback<E> {
  return (element) => {
    const cleanups = refs.map((ref) => {
      if (typeof ref === "function") {
        const cleanup = ref(element);
        return typeof cleanup === "function" ? cleanup : () => ref(null);
      }
      if (ref) ref.current = element;
      return () => {
        if (ref) ref.current = null;
      };
    });
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  };
}
