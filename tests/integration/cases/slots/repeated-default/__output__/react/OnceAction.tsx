import OnceSlot from "./OnceSlot";
import { mergeRefs } from "./_unframework/mergeRefs";
import {
  type ComponentPropsWithoutRef,
  type DOMAttributes,
  type ReactNode,
  type Ref,
  useMemo,
} from "react";

export interface OnceActionSlots {
  children?: ReactNode;
}

export type OnceActionAttributes = Omit<
  ComponentPropsWithoutRef<"a"> & ComponentPropsWithoutRef<"button">,
  "href" | "label" | "children" | keyof DOMAttributes<HTMLAnchorElement | HTMLButtonElement>
> &
  Omit<
    DOMAttributes<HTMLAnchorElement | HTMLButtonElement>,
    "children" | "dangerouslySetInnerHTML"
  > & { ref?: Ref<HTMLAnchorElement | HTMLButtonElement> };

export default function OnceAction({
  href,
  label,
  children,
  className,
  style,
  ref,
  ...attributes
}: { href?: string; label: string } & OnceActionSlots & OnceActionAttributes) {
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
      <OnceSlot
        label={label}
        renderText={(shown) => <span className="once-fill">{children ?? shown.label}</span>}
      />
    </Tag>
  );
}
