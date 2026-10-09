import { ref } from "unframework";

export default function ToppingPicker() {
  const toppings = ref<string[]>(["cheese"]);
  return (
    <section aria-label="Pizza">
      <label>
        Toppings{" "}
        <select multiple v-model={toppings.value}>
          <option value="cheese">Cheese</option>
          <option value="olives">Olives</option>
          <option value="basil">Basil</option>
        </select>
      </label>
      <output>On top: {toppings.value.join(", ") || "nothing"}</output>
      <button type="button" onClick={() => (toppings.value = ["basil", "olives"])}>
        Green
      </button>
    </section>
  );
}
