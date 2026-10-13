import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    const note = useSignal("Buy milk");

    const currentNote = note.value;

    return (
      <section aria-label="Note" class={className} style={style}>
        <textarea
          aria-label="Text"
          value={currentNote}
          onInput$={(_, element) => (note.value = element.value)}
        />
        <output>{note.value.length} characters</output>
        <button type="button" onClick$={() => (note.value = "")}>
          Discard
        </button>
      </section>
    );
  },
);
