import { type JSX, createSignal } from "solid-js";
import { isServer } from "solid-js/web";

export default function NoteEditor(props: { class?: string; style?: JSX.CSSProperties }) {
  const [note, setNote] = createSignal("Buy milk");

  return (
    <section aria-label="Note" class={props.class} style={props.style}>
      <textarea
        aria-label="Text"
        value={isServer ? undefined : note()}
        children={isServer ? note() : undefined}
        onInput={(event) => setNote(event.currentTarget.value)}
      />
      <output>{note().length} characters</output>
      <button type="button" onClick={() => setNote("")}>
        Discard
      </button>
    </section>
  );
}
