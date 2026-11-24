import { mergeRefs } from "./_unframework/mergeRefs";
import { useDirective } from "./_unframework/useDirective";
import { vNote } from "./vNote";
import { type ComponentPropsWithRef, useMemo } from "react";

export type NoteAttributes = Omit<ComponentPropsWithRef<"em">, "children">;

export default function Note({ className, style, ref, ...attributes }: NoteAttributes) {
  const noteRef = useDirective(vNote, () => "note");

  const rootRef = useMemo(() => mergeRefs(noteRef, ref), [noteRef, ref]);

  return (
    <em data-name="note" ref={rootRef} className={className} style={style} {...attributes}>
      Note
    </em>
  );
}
