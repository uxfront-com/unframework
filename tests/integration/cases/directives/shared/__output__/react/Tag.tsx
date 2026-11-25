import { cx } from "./_unframework/cx";
import { mergeRefs } from "./_unframework/mergeRefs";
import { useDirective } from "./_unframework/useDirective";
import { vMark } from "./vMark";
import { type ComponentPropsWithRef, useMemo } from "react";

export interface TagProps {
  name: string;
}

export type TagAttributes = Omit<ComponentPropsWithRef<"em">, "name" | "children">;

export default function Tag({
  name,
  className,
  style,
  ref,
  ...attributes
}: TagProps & TagAttributes) {
  const markRef = useDirective(vMark, () => `tag ${name}`);

  const rootRef = useMemo(() => mergeRefs(markRef, ref), [markRef, ref]);

  return (
    <em className={cx("tag", className)} ref={rootRef} style={style} {...attributes}>
      #{name}
    </em>
  );
}
