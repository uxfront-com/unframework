import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";

export interface TreeAttributes {
  className?: string;
  style?: CSSProperties;
}

const TRACE = "directive-trace";

const vTrace = {
  mounted(el: HTMLElement, value: string): void {
    document.dispatchEvent(new CustomEvent(TRACE, { detail: { call: `mounted ${value}`, el } }));
  },
  unmounted(el: HTMLElement): void {
    const call = `unmounted ${el.getAttribute("data-name")}`;
    document.dispatchEvent(new CustomEvent(TRACE, { detail: { call, el } }));
  },
};

export default function Tree({ className, style, ...attributes }: TreeAttributes) {
  const [shown, setShown] = useState(true);
  const shownRef = useRef(shown);
  const traceRef = useDirective(vTrace, () => "first");
  const traceRef_1 = useDirective(vTrace, () => "leaf");
  const traceRef_2 = useDirective(vTrace, () => "branch");
  const traceRef_3 = useDirective(vTrace, () => "last");
  const traceRef_4 = useDirective(vTrace, () => "outer");

  return (
    <section
      className={cx("tree", className)}
      aria-label="Tree"
      data-name="outer"
      ref={traceRef_4}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <p data-name="first" ref={traceRef}>
        First
      </p>
      {shown ? (
        <div className="branch" data-name="branch" ref={traceRef_2}>
          <span data-name="leaf" ref={traceRef_1}>
            Leaf
          </span>
        </div>
      ) : null}
      <p data-name="last" ref={traceRef_3}>
        Last
      </p>
      <button
        type="button"
        onClick={() => {
          shownRef.current = !shownRef.current;
          setShown(shownRef.current);
        }}
      >
        Toggle
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
  mounted?(el: E, value: T): void;
  updated?(el: E, value: T, oldValue: T): void;
  unmounted?(el: E): void;
}

/**
 * Runs a directive's hooks on the element its ref callback receives: `mounted` once it is
 * rendered, `updated` after a render that changes the value, and `unmounted` once it is gone.
 */
function useDirective<E extends Element, T>(directive: DirectiveHooks<E, T>, getValue: () => T) {
  const state = useRef<{ element: E | null; mounted: E | null; value?: T }>({
    element: null,
    mounted: null,
  });
  const [ref] = useState(() => (element: E | null) => {
    state.current.element = element;
  });
  useLayoutEffect(() => {
    const current = state.current;
    const { element, mounted } = current;
    if (mounted && mounted !== element) {
      current.mounted = null;
      directive.unmounted?.(mounted);
    }
    if (!element) return;
    const value = getValue();
    if (current.mounted !== element) {
      current.mounted = element;
      current.value = value;
      directive.mounted?.(element, value);
    } else if (!Object.is(value, current.value)) {
      const previous = current.value as T;
      current.value = value;
      directive.updated?.(element, value, previous);
    }
  });
  useLayoutEffect(
    () => () => {
      const { mounted } = state.current;
      if (!mounted) return;
      state.current.mounted = null;
      directive.unmounted?.(mounted);
    },
    [directive],
  );
  return ref;
}
