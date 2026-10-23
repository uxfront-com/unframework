import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const size = useSignal("M");
    const quantity = useSignal(1);
    const note = useSignal("");
    const noteField = useSignal<HTMLInputElement>();

    return (
      <section
        class={["shirt-order", className]}
        aria-label="Shirt order"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <p role="status">{`${quantity.value} x size ${size.value}`}</p>
        <div role="group" aria-label="Size">
          <button
            type="button"
            value="S"
            aria-pressed={size.value === "S"}
            onClick$={(_, element) => (size.value = (element as HTMLButtonElement).value)}
          >
            Small
          </button>
          <button
            type="button"
            value="M"
            aria-pressed={size.value === "M"}
            onClick$={(_, element) => (size.value = (element as HTMLButtonElement).value)}
          >
            Medium
          </button>
          <button
            type="button"
            value="L"
            aria-pressed={size.value === "L"}
            onClick$={(_, element) => (size.value = (element as HTMLButtonElement).value)}
          >
            Large
          </button>
        </div>
        <button type="button" onClick$={() => quantity.value++}>
          Add one
        </button>
        <label>
          Note
          <input
            name="note"
            ref={noteField}
            onInput$={(_, element) => (note.value = (element as HTMLInputElement).value)}
          />
        </label>
        <p>Note: {note.value}</p>
        <button
          type="button"
          onClick$={() => {
            quantity.value = 1;
            size.value = "M";
            note.value = "";
            const input = noteField.value ?? null;
            if (input) input.value = "";
          }}
        >
          Reset
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
