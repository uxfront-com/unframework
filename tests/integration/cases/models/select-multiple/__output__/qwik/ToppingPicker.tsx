import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    const toppings = useSignal<string[]>(["cheese"]);

    const currentToppings = toppings.value;

    return (
      <section aria-label="Pizza" class={className} style={style}>
        <label>
          Toppings{" "}
          <select multiple onChange$={(_, element) => (toppings.value = selectedValues(element))}>
            <option selected={currentToppings.includes("cheese")} value="cheese">
              Cheese
            </option>
            <option selected={currentToppings.includes("olives")} value="olives">
              Olives
            </option>
            <option selected={currentToppings.includes("basil")} value="basil">
              Basil
            </option>
          </select>
        </label>
        <output>On top: {toppings.value.join(", ") || "nothing"}</output>
        <button type="button" onClick$={() => (toppings.value = ["basil", "olives"])}>
          Green
        </button>
      </section>
    );
  },
);

/** The values of a multiple select's selected options, as Vue's `vModelSelect` writes them. */
function selectedValues(select: HTMLSelectElement): string[] {
  return Array.from(select.selectedOptions, (option) => option.value);
}
