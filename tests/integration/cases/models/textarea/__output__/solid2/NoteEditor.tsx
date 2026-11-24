import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";

export default function NoteEditor(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [note, setNote] = createState("Buy milk");

  return (
    <section aria-label="Note" {...props}>
      <textarea
        aria-label="Text"
        value={note()}
        onInput={(event) => setNote(event.currentTarget.value)}
        ref={textCaret}
      />
      <output>{note().length} characters</output>
      <button type="button" onClick={() => setNote("")}>
        Discard
      </button>
    </section>
  );
}

/** Puts a field's caret after its text, as setting the text of an empty field leaves it. */
function textCaret(field: HTMLTextAreaElement) {
  const text = field.value;
  field.value = "";
  field.value = text;
}
