import {
  type ComponentPropsWithoutRef,
  type DOMAttributes,
  type Ref,
  type RefCallback,
  useMemo,
} from "react";

export type HeadingAttributes = Omit<
  ComponentPropsWithoutRef<"h2"> & ComponentPropsWithoutRef<"h3">,
  "big" | "text" | "children" | keyof DOMAttributes<HTMLHeadingElement>
> &
  Omit<DOMAttributes<HTMLHeadingElement>, "children" | "dangerouslySetInnerHTML"> & {
    ref?: Ref<HTMLHeadingElement>;
  };

export default function Heading({
  big,
  text,
  className,
  style,
  ref,
  ...attributes
}: { big: boolean; text: string } & HeadingAttributes) {
  const rootRef = useMemo(() => mergeRefs(ref), [ref]);

  const Tag = big ? "h2" : "h3";

  return (
    <Tag className={cx("heading", className)} style={style} ref={rootRef} {...attributes}>
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
