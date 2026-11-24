import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

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
    <div className={cx("note-box", className)} style={style} {...scopeAttributes(attributes)}>
      <p className="note">{text}</p>
    </div>
  );
}
