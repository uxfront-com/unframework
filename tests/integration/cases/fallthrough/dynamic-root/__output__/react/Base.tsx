import { cx } from "./_unframework/cx";
import { mergeRefs } from "./_unframework/mergeRefs";
import {
  type ComponentPropsWithoutRef,
  type DOMAttributes,
  type MouseEvent,
  type Ref,
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
