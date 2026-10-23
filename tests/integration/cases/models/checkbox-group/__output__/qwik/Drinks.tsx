import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const drinks = useSignal<string[]>(["tea"]);

    const currentDrinks = drinks.value;

    return (
      <fieldset {...scopeAttributes(attributes)} class={className} style={style}>
        <legend>Drinks</legend>
        <label>
          <input
            type="checkbox"
            value="tea"
            checked={currentDrinks.includes("tea")}
            onChange$={(_, element) =>
              (drinks.value = toggle(drinks.value, "tea", element.checked))
            }
          />{" "}
          Tea
        </label>
        <label>
          <input
            type="checkbox"
            value="coffee"
            checked={currentDrinks.includes("coffee")}
            onChange$={(_, element) =>
              (drinks.value = toggle(drinks.value, "coffee", element.checked))
            }
          />{" "}
          Coffee
        </label>
        <label>
          <input
            type="checkbox"
            value="juice"
            checked={currentDrinks.includes("juice")}
            onChange$={(_, element) =>
              (drinks.value = toggle(drinks.value, "juice", element.checked))
            }
          />{" "}
          Juice
        </label>
        <output>Ordered: {drinks.value.join(", ") || "nothing"}</output>
        <button type="button" onClick$={() => (drinks.value = ["juice"])}>
          Only juice
        </button>
      </fieldset>
    );
  },
);

/** The values with `value` added or removed, as Vue's `vModelCheckbox` writes a checkbox group. */
function toggle<T>(values: readonly T[], value: T, checked: boolean): T[] {
  if (!checked) return values.filter((each) => each !== value);
  return values.includes(value) ? [...values] : [...values, value];
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
