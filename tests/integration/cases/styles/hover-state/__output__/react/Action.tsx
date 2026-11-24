import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";
import "./Action.uf.tsx.css";

export interface ActionAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Action({
  text,
  className,
  style,
  ...attributes
}: { text: string } & ActionAttributes) {
  return (
    <button
      type="button"
      className={cx("action", className)}
      style={style}
      data-uf-6173c12c=""
      {...scopeAttributes(attributes)}
    >
      {text}
    </button>
  );
}
