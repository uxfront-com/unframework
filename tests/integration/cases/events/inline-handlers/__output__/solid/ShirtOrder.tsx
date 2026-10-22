import { type JSX, createSignal, onCleanup } from "solid-js";

export default function ShirtOrder(props: { class?: string; style?: JSX.CSSProperties }) {
  const [size, setSize] = createSignal("M");
  const [quantity, setQuantity] = createSignal(1);
  const [note, setNote] = createSignal("");
  let noteField: HTMLInputElement | null = null;

  return (
    <section
      class={props.class ? `shirt-order ${props.class}` : "shirt-order"}
      aria-label="Shirt order"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <p role="status">{`${quantity()} x size ${size()}`}</p>
      <div role="group" aria-label="Size">
        <button
          type="button"
          value="S"
          aria-pressed={size() === "S"}
          onClick={(event) => setSize((event.currentTarget as HTMLButtonElement).value)}
        >
          Small
        </button>
        <button
          type="button"
          value="M"
          aria-pressed={size() === "M"}
          onClick={(event) => setSize((event.currentTarget as HTMLButtonElement).value)}
        >
          Medium
        </button>
        <button
          type="button"
          value="L"
          aria-pressed={size() === "L"}
          onClick={(event) => setSize((event.currentTarget as HTMLButtonElement).value)}
        >
          Large
        </button>
      </div>
      <button type="button" onClick={() => setQuantity(quantity() + 1)}>
        Add one
      </button>
      <label>
        Note
        <input
          name="note"
          ref={(element) => {
            noteField = element;
            onCleanup(() => {
              noteField = null;
            });
          }}
          onInput={(event) => setNote((event.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <p>Note: {note()}</p>
      <button
        type="button"
        onClick={() => {
          setQuantity(1);
          setSize("M");
          setNote("");
          const input = noteField;
          if (input) input.value = "";
        }}
      >
        Reset
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
