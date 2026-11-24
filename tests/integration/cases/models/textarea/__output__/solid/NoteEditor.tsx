import { type ComponentProps, type JSX, createSignal } from "solid-js";
import { isServer } from "solid-js/web";

export default function NoteEditor(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [note, setNote] = createSignal("Buy milk");

  return (
    <section aria-label="Note" {...props}>
      <textarea
        aria-label="Text"
        value={isServer ? undefined : note()}
        children={isServer ? note() : undefined}
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
