import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export interface DeliveryProps {
  speeds: string[];
  extras: string[];
}

export default component$<DeliveryProps & { class?: ClassList; style?: CSSProperties }>(
  ({ speeds, extras, class: className, style, ...attributes }) => {
    const speed = useSignal("express");
    const chosen = useSignal<string[]>(["insurance"]);

    const currentSpeed = speed.value;
    const currentChosen = chosen.value;

    return (
      <section
        aria-label="Delivery"
        {...scopeAttributes(attributes)}
        class={className}
        style={style}
      >
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
