import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";

export default function ToppingPicker(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [toppings, setToppings] = createState<string[]>(["cheese"]);

  return (
    <section aria-label="Pizza" {...props}>
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
