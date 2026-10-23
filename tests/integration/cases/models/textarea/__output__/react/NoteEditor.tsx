import { type CSSProperties, useRef, useState } from "react";

export interface NoteEditorAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function NoteEditor({ className, style, ...attributes }: NoteEditorAttributes) {
  const [note, setNote] = useState("Buy milk");
  const noteRef = useRef(note);

  const [textCaret] = useState(() => (element: HTMLTextAreaElement | null) => {
    if (element) {
      const text = element.value;
      element.value = "";
      element.value = text;
    }
  });

  return (
    <section aria-label="Note" className={className} style={style} {...scopeAttributes(attributes)}>
      <textarea
        aria-label="Text"
        value={note}
        onChange={(event) => {
          noteRef.current = event.target.value;
          setNote(noteRef.current);
        }}
        ref={textCaret}
      />
      <output>{note.length} characters</output>
      <button
        type="button"
        onClick={() => {
          noteRef.current = "";
          setNote(noteRef.current);
        }}
      >
        Discard
      </button>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
