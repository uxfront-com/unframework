import { Transition } from "./_unframework/Transition";
import { mergeRefs } from "./_unframework/mergeRefs";
import {
  type ComponentPropsWithoutRef,
  type DOMAttributes,
  type ReactNode,
  type Ref,
  useMemo,
} from "react";

export interface FadeActionSlots {
  children?: ReactNode;
}

export type FadeActionAttributes = Omit<
  ComponentPropsWithoutRef<"a"> & ComponentPropsWithoutRef<"button">,
  "href" | "label" | "children" | keyof DOMAttributes<HTMLAnchorElement | HTMLButtonElement>
> &
  Omit<
    DOMAttributes<HTMLAnchorElement | HTMLButtonElement>,
    "children" | "dangerouslySetInnerHTML"
  > & { ref?: Ref<HTMLAnchorElement | HTMLButtonElement> };

export default function FadeAction({
  href,
  label,
  children,
  className,
  style,
  ref,
  ...attributes
}: { href?: string; label: string } & FadeActionSlots & FadeActionAttributes) {
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
      <Transition name="fade">
        <span>{children ?? label}</span>
      </Transition>
    </Tag>
  );
}
