import { type CSSProperties, useRef, useState } from "react";

export interface NoteEditorAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function NoteEditor({ className, style }: NoteEditorAttributes) {
  const [note, setNote] = useState("Buy milk");
  const noteRef = useRef(note);

  const [textCaret] = useState(() => (element: HTMLTextAreaElement | null) => {
    if (element) element.setSelectionRange(element.value.length, element.value.length);
  });

  return (
    <section aria-label="Note" className={className} style={style}>
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
