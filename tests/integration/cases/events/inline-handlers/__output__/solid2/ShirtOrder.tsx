import { clearedRef } from "./_unframework/clearedRef";
import { createState } from "./_unframework/createState";
import { enumeratedValue } from "./_unframework/enumeratedValue";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function ShirtOrder(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [size, setSize] = createState("M");
  const [quantity, setQuantity] = createState(1);
  const [note, setNote] = createState("");
  let noteField: HTMLInputElement | null = null;

  return (
    <section
      class={props.class ? `shirt-order ${props.class}` : "shirt-order"}
      aria-label="Shirt order"
      {...others}
    >
      <p role="status">{`${quantity()} x size ${size()}`}</p>
      <div role="group" aria-label="Size">
        <button
          type="button"
          value="S"
          aria-pressed={enumeratedValue(size() === "S")}
          onClick={(event) => setSize((event.currentTarget as HTMLButtonElement).value)}
        >
          Small
        </button>
        <button
          type="button"
          value="M"
          aria-pressed={enumeratedValue(size() === "M")}
          onClick={(event) => setSize((event.currentTarget as HTMLButtonElement).value)}
        >
          Medium
        </button>
        <button
          type="button"
          value="L"
          aria-pressed={enumeratedValue(size() === "L")}
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
          ref={clearedRef(
            (element) => {
              noteField = element;
            },
            () => {
              noteField = null;
            },
          )}
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
