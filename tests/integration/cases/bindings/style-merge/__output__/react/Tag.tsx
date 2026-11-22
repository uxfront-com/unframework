import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface TagProps {
  label: string;
  colour?: string;
  weight?: number;
  indent?: string;
}

export interface TagAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Tag({
  label,
  colour,
  weight,
  indent,
  className,
  style,
  ...attributes
}: TagProps & TagAttributes) {
  return (
    <span
      className={cx("tag", className)}
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderStyle: "solid",
        borderWidth: "1px",
        borderColor: colour ?? "#5a5a5a",
        color: colour,
        fontWeight: weight,
        marginLeft: indent,
        ...style,
      }}
      {...scopeAttributes(attributes)}
    >
      {label}
    </span>
  );
}
