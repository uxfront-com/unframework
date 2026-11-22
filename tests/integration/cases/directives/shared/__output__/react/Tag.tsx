import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { useDirective } from "./_unframework/useDirective";
import { vMark } from "./vMark";
import type { CSSProperties } from "react";

export interface TagProps {
  name: string;
}

export interface TagAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Tag({ name, className, style, ...attributes }: TagProps & TagAttributes) {
  const markRef = useDirective(vMark, () => `tag ${name}`);

  return (
    <em
      className={cx("tag", className)}
      ref={markRef}
      style={style}
      {...scopeAttributes(attributes)}
    >
      #{name}
    </em>
  );
}
