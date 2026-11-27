import { cx } from "./_unframework/cx";
import { mergeRefs } from "./_unframework/mergeRefs";
import {
  type ComponentPropsWithoutRef,
  type DOMAttributes,
  type ReactNode,
  type Ref,
  useMemo,
} from "react";

export interface TagListSlots {
  children?: ReactNode;
}

export type TagListAttributes = Omit<
  ComponentPropsWithoutRef<"ol"> & ComponentPropsWithoutRef<"ul">,
  | "ordered"
  | "label"
  | "items"
  | "children"
  | keyof DOMAttributes<HTMLOListElement | HTMLUListElement>
> &
  Omit<
    DOMAttributes<HTMLOListElement | HTMLUListElement>,
    "children" | "dangerouslySetInnerHTML"
  > & { ref?: Ref<HTMLOListElement | HTMLUListElement> };

export default function TagList({
  ordered,
  label,
  items,
  children,
  className,
  style,
  ref,
  ...attributes
}: { ordered: boolean; label: string; items: string[] } & TagListSlots & TagListAttributes) {
  const rootRef = useMemo(() => mergeRefs(ref), [ref]);

  const Tag = ordered ? "ol" : "ul";

  return (
    <Tag
      className={cx("tag-list", className)}
      aria-label={label}
      style={style}
      ref={rootRef}
      {...attributes}
    >
      {items.map((item) => (
        <li key={item}>{children ?? item}</li>
      ))}
    </Tag>
  );
}
