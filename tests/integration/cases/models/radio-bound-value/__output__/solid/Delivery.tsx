import { For, type JSX, createSignal } from "solid-js";

export interface DeliveryProps {
  speeds: string[];
  extras: string[];
}

export default function Delivery(
  props: DeliveryProps & { class?: string; style?: JSX.CSSProperties },
) {
  const [speed, setSpeed] = createSignal("express");
  const [chosen, setChosen] = createSignal<string[]>(["insurance"]);

  return (
    <section
      aria-label="Delivery"
      class={props.class}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <fieldset>
        <legend>Speed</legend>
        <For each={props.speeds}>
          {(value) => (
            <label>
              <input
                type="radio"
                name="speed"
                value={value}
                checked={speed() === value}
                onChange={() => setSpeed(value)}
              />{" "}
              {value}
            </label>
          )}
        </For>
      </fieldset>
      <fieldset>
        <legend>Extras</legend>
        <For each={props.extras}>
          {(extra) => (
            <label>
              <input
                type="checkbox"
                value={extra}
                checked={chosen().includes(extra)}
                onChange={(event) =>
                  setChosen(toggle(chosen(), extra, event.currentTarget.checked))
                }
              />{" "}
              {extra}
            </label>
          )}
        </For>
      </fieldset>
      <output>
        Speed: {speed()}, extras: {chosen().join(", ") || "none"}
      </output>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/** The values with `value` added when `checked`, and removed otherwise. */
function toggle<T>(values: readonly T[], value: T, checked: boolean): T[] {
  return checked ? [...values, value] : values.filter((each) => each !== value);
}
