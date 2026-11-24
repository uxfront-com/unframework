import {
  type ComponentPropsWithoutRef,
  type DOMAttributes,
  type MouseEvent,
  type Ref,
  type RefCallback,
  useMemo,
} from "react";

export interface BaseEvents {
  onPress?: () => void;
}

export type BaseAttributes = Omit<
  ComponentPropsWithoutRef<"a"> & ComponentPropsWithoutRef<"button">,
  | "href"
  | "disabled"
  | "text"
  | "onPress"
  | "children"
  | keyof DOMAttributes<HTMLAnchorElement | HTMLButtonElement>
> &
  Omit<
    DOMAttributes<HTMLAnchorElement | HTMLButtonElement>,
    "children" | "dangerouslySetInnerHTML" | "onPress"
  > & { ref?: Ref<HTMLAnchorElement | HTMLButtonElement> };

export default function Base({
  href,
  disabled,
  text,
  onPress,
  className,
  style,
  onClick,
  ref,
  ...attributes
}: { href?: string; disabled?: boolean; text: string } & BaseEvents & BaseAttributes) {
  function press(event: MouseEvent) {
    event.preventDefault();
    onPress?.();
  }

  const rootRef = useMemo(() => mergeRefs(ref), [ref]);

  const Tag = href ? "a" : "button";

  return (
    <Tag
      href={Tag === "a" ? href : undefined}
      disabled={Tag === "button" ? disabled : undefined}
      className={cx("base", className)}
      style={{ padding: "4px 8px", ...style }}
      onClick={(event) => {
        press(event);
        onClick?.(event);
      }}
      ref={rootRef}
      {...attributes}
    >
      {text}
    </Tag>
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
