import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";

export default function Drinks(
  props: Omit<ComponentProps<"fieldset">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [drinks, setDrinks] = createState<string[]>(["tea"]);

  return (
    <fieldset {...props}>
      <legend>Drinks</legend>
      <label>
        <input
          type="checkbox"
          value="tea"
          checked={drinks().includes("tea")}
          onChange={(event) => setDrinks(toggle(drinks(), "tea", event.currentTarget.checked))}
        />{" "}
        Tea
      </label>
      <label>
        <input
          type="checkbox"
          value="coffee"
          checked={drinks().includes("coffee")}
          onChange={(event) => setDrinks(toggle(drinks(), "coffee", event.currentTarget.checked))}
        />{" "}
        Coffee
      </label>
      <label>
        <input
          type="checkbox"
          value="juice"
          checked={drinks().includes("juice")}
          onChange={(event) => setDrinks(toggle(drinks(), "juice", event.currentTarget.checked))}
        />{" "}
        Juice
      </label>
      <output>Ordered: {drinks().join(", ") || "nothing"}</output>
      <button type="button" onClick={() => setDrinks(["juice"])}>
        Only juice
      </button>
    </fieldset>
  );
}

/** The values with `value` added when `checked`, and removed otherwise. */
function toggle<T>(values: readonly T[], value: T, checked: boolean): T[] {
  return checked ? [...values, value] : values.filter((each) => each !== value);
}
