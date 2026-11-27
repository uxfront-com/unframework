import { cx } from "./_unframework/cx";
import { mergeRefs } from "./_unframework/mergeRefs";
import {
  type ComponentPropsWithoutRef,
  type DOMAttributes,
  type ReactNode,
  type Ref,
  useMemo,
} from "react";

export interface ActionSlots {
  children?: ReactNode;
  icon?: ReactNode;
}

export type ActionAttributes = Omit<
  ComponentPropsWithoutRef<"a"> & ComponentPropsWithoutRef<"button">,
  | "href"
  | "label"
  | "children"
  | "icon"
  | keyof DOMAttributes<HTMLAnchorElement | HTMLButtonElement>
> &
  Omit<
    DOMAttributes<HTMLAnchorElement | HTMLButtonElement>,
    "children" | "dangerouslySetInnerHTML"
  > & { ref?: Ref<HTMLAnchorElement | HTMLButtonElement> };

export default function Action({
  href,
  label,
  children,
  icon,
  className,
  style,
  ref,
  ...attributes
}: { href?: string; label: string } & ActionSlots & ActionAttributes) {
  const rootRef = useMemo(() => mergeRefs(ref), [ref]);

  const Tag = href ? "a" : "button";

  return (
    <Tag
      href={Tag === "a" ? href : undefined}
      className={cx("action", className)}
      style={style}
      ref={rootRef}
      {...attributes}
    >
      {icon}
      <span data-slot="label">{children ?? label}</span>
    </Tag>
  );
}
