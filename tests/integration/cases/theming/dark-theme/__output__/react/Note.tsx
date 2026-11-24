import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";
import "virtual:styleframe.css";

export interface NoteAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Note({
  text,
  className,
  style,
  ...attributes
}: { text: string } & NoteAttributes) {
  return (
    <p
      className={cx("_padding:md _background-color:surface _color:text", className)}
      style={style}
      {...scopeAttributes(attributes)}
    >
      {text}
    </p>
  );
}
