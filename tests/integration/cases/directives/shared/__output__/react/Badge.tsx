import { cx } from "./_unframework/cx";
import { mergeRefs } from "./_unframework/mergeRefs";
import { useDirective } from "./_unframework/useDirective";
import { vMark } from "./vMark";
import { type ComponentPropsWithRef, useMemo } from "react";

export interface BadgeProps {
  label: string;
}

export type BadgeAttributes = Omit<ComponentPropsWithRef<"span">, "label" | "children">;

export default function Badge({
  label,
  className,
  style,
  ref,
  ...attributes
}: BadgeProps & BadgeAttributes) {
  const markRef = useDirective(vMark, () => "badge");

  const rootRef = useMemo(() => mergeRefs(markRef, ref), [markRef, ref]);

  return (
    <span className={cx("badge", className)} ref={rootRef} style={style} {...attributes}>
      {label}
    </span>
  );
}
