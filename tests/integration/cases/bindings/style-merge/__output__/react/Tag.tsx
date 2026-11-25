import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export interface TagProps {
  label: string;
  colour?: string;
  weight?: number;
  indent?: string;
}

export type TagAttributes = Omit<
  ComponentPropsWithRef<"span">,
  "label" | "colour" | "weight" | "indent" | "children"
>;

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
      {...attributes}
    >
      {label}
    </span>
  );
}
