import { mergeRefs } from "./_unframework/mergeRefs";
import {
  type ComponentPropsWithoutRef,
  type DOMAttributes,
  type ReactNode,
  type Ref,
  useMemo,
} from "react";

export interface SwitchActionSlots {
  children?: ReactNode;
}

export type SwitchActionAttributes = Omit<
  ComponentPropsWithoutRef<"a"> & ComponentPropsWithoutRef<"button">,
  "href" | "children" | keyof DOMAttributes<HTMLAnchorElement | HTMLButtonElement>
> &
  Omit<
    DOMAttributes<HTMLAnchorElement | HTMLButtonElement>,
    "children" | "dangerouslySetInnerHTML"
  > & { ref?: Ref<HTMLAnchorElement | HTMLButtonElement> };

export default function SwitchAction({
  href,
  children,
  className,
  style,
  ref,
  ...attributes
}: { href?: string } & SwitchActionSlots & SwitchActionAttributes) {
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
      {href ? <b>{children}</b> : <i>{children}</i>}
    </Tag>
  );
}
