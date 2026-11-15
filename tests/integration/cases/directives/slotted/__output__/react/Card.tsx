import Disclosure from "./Disclosure";
import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";

export interface CardAttributes {
  className?: string;
  style?: CSSProperties;
}

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

export default function Card({ className, style, ...attributes }: CardAttributes) {
  const [note] = useState<{ name: string } | null>({ name: "note" });
  const traceRef = useDirective(vTrace, () => "body");
  const traceRef_1 = useDirective(vTrace, () => note!.name);

  return (
    <section
      className={cx("card", className)}
      aria-label="Card"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <Disclosure>
        <p data-name="body" ref={traceRef}>
          Body
        </p>
        {note ? (
          <p data-name="note" ref={traceRef_1}>
            Note
          </p>
        ) : null}
      </Disclosure>
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}

/** The hooks of a directive, which `useDirective` runs on its element. */
interface DirectiveHooks<E extends Element, T> {
  mounted?(el: E, value: T): unknown;
  updated?(el: E, value: T, oldValue: T): unknown;
  unmounted?(el: E): unknown;
}

/**
 * Runs a directive's hooks on the element its ref callback receives: `mounted` once it is
 * rendered, `updated` after a render that changes the value, and `unmounted` once it is gone,
 * whichever component renders or removes it. The callback only records the element, so one
 * written in place, attached again at each render, keeps the directive.
 */
function useDirective<E extends Element, T>(directive: DirectiveHooks<E, T>, getValue: () => T) {
  const state = useRef<{ element: E | null; getValue: () => T; mounted: E | null; value?: T }>({
    element: null,
    getValue,
    mounted: null,
  });
  const [sync] = useState(() => () => {
    const current = state.current;
    const { element, mounted } = current;
    if (mounted && mounted !== element) {
      current.mounted = null;
      queueHook(mounted, () => directive.unmounted?.(mounted), true);
    }
    if (!element) return;
    const value = current.getValue();
    if (current.mounted !== element) {
      current.mounted = element;
      current.value = value;
      queueHook(element, () => directive.mounted?.(element, value));
    } else if (!Object.is(value, current.value)) {
      const previous = current.value as T;
      current.value = value;
      queueHook(element, () => directive.updated?.(element, value, previous));
    }
  });
  const [ref] = useState(() => (element: E | null) => {
    state.current.element = element;
    queueMicrotask(sync);
  });
  useLayoutEffect(() => {
    state.current.getValue = getValue;
    sync();
  });
  useLayoutEffect(
    () => () => {
      state.current.element = null;
      sync();
    },
    [sync],
  );
  return ref;
}

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
