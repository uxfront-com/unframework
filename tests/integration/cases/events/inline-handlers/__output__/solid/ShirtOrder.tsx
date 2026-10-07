import { createSignal, onCleanup } from "solid-js";

export default function ShirtOrder() {
  const [size, setSize] = createSignal("M");
  const [quantity, setQuantity] = createSignal(1);
  const [note, setNote] = createSignal("");
  let noteField: HTMLInputElement | null = null;

  return (
    <section class="shirt-order" aria-label="Shirt order">
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
