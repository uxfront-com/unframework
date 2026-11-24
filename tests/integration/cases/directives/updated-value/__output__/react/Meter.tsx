import { vRecord } from "./vRecord";
import { type ComponentPropsWithRef, useLayoutEffect, useRef, useState } from "react";

export type MeterAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

export default function Meter({ className, style, ...attributes }: MeterAttributes) {
  const [level, setLevel] = useState(1);
  const levelRef = useRef(level);
  const [renders, setRenders] = useState(0);
  const rendersRef = useRef(renders);
  const recordRef = useDirective(vRecord, () => level);

  return (
    <section className={cx("meter", className)} aria-label="Meter" style={style} {...attributes}>
      <output className="level" ref={recordRef}>
        Level {level}
      </output>
      <p>Rendered again {renders} times</p>
      <button
        type="button"
        onClick={() => {
          levelRef.current++;
          setLevel(levelRef.current);
        }}
      >
        Raise
      </button>
      <button
        type="button"
        onClick={() => {
          rendersRef.current++;
          setRenders(rendersRef.current);
        }}
      >
        Render again
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

/** The hooks of a directive, which `useDirective` runs on its elements. */
interface DirectiveHooks<E extends Element, T> {
  mounted?(el: E, value: T): unknown;
  updated?(el: E, value: T, oldValue: T): unknown;
  unmounted?(el: E): unknown;
}

/**
 * Runs a directive's hooks on each element its ref callback receives, apart: `mounted` once
 * the element is rendered, `updated` after a render that changes the value, and `unmounted`
 * once that element is gone, whichever component renders or removes it. One use may render
 * several elements, as a slot a child renders in a list. The callback only records the element,
 * and its cleanup forgets that one, so a callback written in place keeps the directive.
 */
function useDirective<E extends Element, T>(directive: DirectiveHooks<E, T>, getValue: () => T) {
  const state = useRef<{ getValue: () => T; attached: Set<E>; mounted: Map<E, T> }>({
    getValue,
    attached: new Set(),
    mounted: new Map(),
  });
  const [sync] = useState(() => () => {
    const { attached, mounted } = state.current;
    for (const element of [...mounted.keys()]) {
      if (attached.has(element)) continue;
      mounted.delete(element);
      queueHook(element, () => directive.unmounted?.(element), "unmounted");
    }
    if (!attached.size) return;
    const value = state.current.getValue();
    for (const element of attached) {
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
  const [ref] = useState(() => (element: E | null) => {
    if (!element) return () => {};
    state.current.attached.add(element);
    queueMicrotask(sync);
    return () => {
      state.current.attached.delete(element);
      queueMicrotask(sync);
    };
  });
  useLayoutEffect(() => {
    state.current.getValue = getValue;
    sync();
  });
  useLayoutEffect(
    () => () => {
      state.current.attached.clear();
      sync();
    },
    [sync],
  );
  return ref;
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
