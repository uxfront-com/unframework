import { ref } from "unframework";

export default function Drinks() {
  const drinks = ref<string[]>(["tea"]);
  return (
    <fieldset>
      <legend>Drinks</legend>
      <label>
        <input type="checkbox" value="tea" v-model={drinks.value} /> Tea
      </label>
      <label>
        <input type="checkbox" value="coffee" v-model={drinks.value} /> Coffee
      </label>
      <label>
        <input type="checkbox" value="juice" v-model={drinks.value} /> Juice
      </label>
      <output>Ordered: {drinks.value.join(", ") || "nothing"}</output>
      <button type="button" onClick={() => (drinks.value = ["juice"])}>
        Only juice
      </button>
    </fieldset>
  );
}
