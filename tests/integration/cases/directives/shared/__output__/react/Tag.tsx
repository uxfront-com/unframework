import { vMark } from "./vMark";
import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";

export interface TagProps {
  name: string;
}

export interface TagAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Tag({ name, className, style, ...attributes }: TagProps & TagAttributes) {
  const markRef = useDirective(vMark, () => `tag ${name}`);

  return (
    <em
      className={cx("tag", className)}
      ref={markRef}
      style={style}
      {...scopeAttributes(attributes)}
    >
      #{name}
    </em>
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
