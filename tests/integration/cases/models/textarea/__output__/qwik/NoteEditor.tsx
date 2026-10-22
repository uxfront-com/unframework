import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const note = useSignal("Buy milk");

    const currentNote = note.value;

    return (
      <section aria-label="Note" {...scopeAttributes(attributes)} class={className} style={style}>
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
