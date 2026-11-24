import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
} from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"section">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const note = useSignal("Buy milk");

  const currentNote = note.value;

  return (
    <section aria-label="Note" class={className} style={style} {...attributes}>
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
});
