import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
} from "@qwik.dev/core";

export interface DeliveryProps {
  speeds: string[];
  extras: string[];
}

export default component$<
  DeliveryProps &
    Omit<PropsOf<"section">, "speeds" | "extras" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ speeds, extras, class: className, style, ...attributes }) => {
  const speed = useSignal("express");
  const chosen = useSignal<string[]>(["insurance"]);

  const currentSpeed = speed.value;
  const currentChosen = chosen.value;

  return (
    <section aria-label="Delivery" class={className} style={style} {...attributes}>
      <fieldset>
        <legend>Speed</legend>
        {speeds.map((value) => (
          <label key={value}>
            <input
              type="radio"
              name="speed"
              value={value}
              checked={currentSpeed === value}
              onChange$={() => (speed.value = value)}
            />{" "}
            {value}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Extras</legend>
        {extras.map((extra) => (
          <label key={extra}>
            <input
              type="checkbox"
              value={extra}
              checked={currentChosen.includes(extra)}
              onChange$={(_, element) =>
                (chosen.value = toggle(chosen.value, extra, element.checked))
              }
            />{" "}
            {extra}
          </label>
        ))}
      </fieldset>
      <output>
        Speed: {speed.value}, extras: {chosen.value.join(", ") || "none"}
      </output>
    </section>
  );
});

/** The values with `value` added or removed, as Vue's `vModelCheckbox` writes a checkbox group. */
function toggle<T>(values: readonly T[], value: T, checked: boolean): T[] {
  if (!checked) return values.filter((each) => each !== value);
  return values.includes(value) ? [...values] : [...values, value];
}
