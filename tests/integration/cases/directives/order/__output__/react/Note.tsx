import { vNote } from "./vNote";
import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";

export interface NoteAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Note({ className, style, ...attributes }: NoteAttributes) {
  const noteRef = useDirective(vNote, () => "note");

  return (
    <em
      data-name="note"
      ref={noteRef}
      className={className}
      style={style}
      {...scopeAttributes(attributes)}
    >
      Note
    </em>
  );
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
      queueHook(mounted, () => directive.unmounted?.(mounted));
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
