import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface ButtonAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Button({
  text,
  className,
  style,
  ...attributes
}: { text: string } & ButtonAttributes) {
  return (
    <button
      type="button"
      className={cx("button", className)}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <span className="icon" aria-hidden="true">
        +
      </span>
      {text}
    </button>
  );
}
