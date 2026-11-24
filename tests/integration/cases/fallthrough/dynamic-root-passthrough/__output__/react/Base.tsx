import { cx } from "./_unframework/cx";
import { mergeRefs } from "./_unframework/mergeRefs";
import {
  type ComponentPropsWithoutRef,
  type DOMAttributes,
  type MouseEvent,
  type Ref,
  useMemo,
} from "react";

export type BaseAttributes = Omit<
  ComponentPropsWithoutRef<"a"> & ComponentPropsWithoutRef<"button">,
  | "href"
  | "disabled"
  | "text"
  | "children"
  | keyof DOMAttributes<HTMLAnchorElement | HTMLButtonElement>
> &
  Omit<
    DOMAttributes<HTMLAnchorElement | HTMLButtonElement>,
    "children" | "dangerouslySetInnerHTML"
  > & { ref?: Ref<HTMLAnchorElement | HTMLButtonElement> };

function press(event: MouseEvent) {
  event.preventDefault();
}

export default function Base({
  href,
  disabled,
  text,
  className,
  style,
  onClick,
  ref,
  ...attributes
}: { href?: string; disabled?: boolean; text: string } & BaseAttributes) {
  const rootRef = useMemo(() => mergeRefs(ref), [ref]);

  const Tag = href ? "a" : "button";

  return (
    <Tag
      href={Tag === "a" ? href : undefined}
      disabled={Tag === "button" ? disabled : undefined}
      className={cx("base", className)}
      title="Base"
      onClick={(event) => {
        press(event);
        onClick?.(event);
      }}
      style={style}
      ref={rootRef}
      {...attributes}
    >
      {text}
    </Tag>
  );
}
