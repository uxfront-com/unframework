import { scopeAttributes } from "./_unframework/scopeAttributes";
import { useDirective } from "./_unframework/useDirective";
import { vNote } from "./vNote";
import type { CSSProperties } from "react";

export interface NoteAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Note({ className, style, ...attributes }: NoteAttributes) {
  const noteRef = useDirective(vNote, () => "note");

  return (
    <em
      data-name="note"
      ref={noteRef}
      className={className}
      style={style}
      {...scopeAttributes(attributes)}
    >
      Note
    </em>
  );
}
