import EachSlot from "./EachSlot";
import { mergeRefs } from "./_unframework/mergeRefs";
import {
  type ComponentPropsWithoutRef,
  type DOMAttributes,
  type ReactNode,
  type Ref,
  useMemo,
} from "react";

export interface EachActionSlots {
  children?: ReactNode;
}

export type EachActionAttributes = Omit<
  ComponentPropsWithoutRef<"a"> & ComponentPropsWithoutRef<"button">,
  "href" | "items" | "children" | keyof DOMAttributes<HTMLAnchorElement | HTMLButtonElement>
> &
  Omit<
    DOMAttributes<HTMLAnchorElement | HTMLButtonElement>,
    "children" | "dangerouslySetInnerHTML"
  > & { ref?: Ref<HTMLAnchorElement | HTMLButtonElement> };

export default function EachAction({
  href,
  items,
  children,
  className,
  style,
  ref,
  ...attributes
}: { href?: string; items: string[] } & EachActionSlots & EachActionAttributes) {
  const rootRef = useMemo(() => mergeRefs(ref), [ref]);

  const Tag = href ? "a" : "button";

  return (
    <Tag
      href={Tag === "a" ? href : undefined}
      className={className}
      style={style}
      ref={rootRef}
      {...attributes}
    >
      <EachSlot
        items={items}
        renderRow={({ item }) => <span className="each-fill">{children ?? item}</span>}
      />
    </Tag>
  );
}
