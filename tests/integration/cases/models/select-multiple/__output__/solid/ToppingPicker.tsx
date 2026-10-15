import { type JSX, createSignal } from "solid-js";

export default function ToppingPicker(props: { class?: string; style?: JSX.CSSProperties }) {
  const [toppings, setToppings] = createSignal<string[]>(["cheese"]);

  return (
    <section aria-label="Pizza" class={props.class} style={props.style}>
      <label>
        Toppings{" "}
        <select multiple onChange={(event) => setToppings(selectedValues(event.currentTarget))}>
          <option value="cheese" selected={toppings().includes("cheese")}>
            Cheese
          </option>
          <option value="olives" selected={toppings().includes("olives")}>
            Olives
          </option>
          <option value="basil" selected={toppings().includes("basil")}>
            Basil
          </option>
        </select>
      </label>
      <output>On top: {toppings().join(", ") || "nothing"}</output>
      <button type="button" onClick={() => setToppings(["basil", "olives"])}>
        Green
      </button>
    </section>
  );
}

/** The values of a `<select multiple>`'s selected options, in their order. */
function selectedValues(select: HTMLSelectElement): string[] {
  return Array.from(select.selectedOptions, (option) => option.value);
}
