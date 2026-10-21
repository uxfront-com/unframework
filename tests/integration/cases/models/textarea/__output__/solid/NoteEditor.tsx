import { type JSX, createSignal } from "solid-js";
import { isServer } from "solid-js/web";

export default function NoteEditor(props: { class?: string; style?: JSX.CSSProperties }) {
  const [note, setNote] = createSignal("Buy milk");

  return (
    <section aria-label="Note" class={props.class} style={props.style} {...scopeAttributes(props)}>
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
