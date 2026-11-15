import { vClickOutside } from "./vClickOutside";
import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";

export interface ProfileMenuEvents {
  onClosed?: () => void;
}

export interface ProfileMenuAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function ProfileMenu({
  onClosed,
  className,
  style,
  ...attributes
}: ProfileMenuEvents & ProfileMenuAttributes) {
  const onClosedRef = useRef(onClosed);
  useLayoutEffect(() => {
    onClosedRef.current = onClosed;
  });

  const [open, setOpen] = useState(false);
  const openRef = useRef(open);

  const [close] = useState(() => () => {
    if (!openRef.current) return;
    openRef.current = false;
    setOpen(openRef.current);
    onClosedRef.current?.();
  });

  const clickOutsideRef = useDirective(vClickOutside, () => close);

  return (
    <section
      className={cx("profile-menu", className)}
      aria-label="Profile"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <div className="menu" ref={clickOutsideRef}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            openRef.current = !openRef.current;
            setOpen(openRef.current);
          }}
        >
          Account
        </button>
        {open ? (
          <ul aria-label="Account actions">
            <li>
              <button type="button">Settings</button>
            </li>
            <li>
              <button type="button">Sign out</button>
            </li>
          </ul>
        ) : null}
      </div>
      <p>Outside the menu</p>
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
