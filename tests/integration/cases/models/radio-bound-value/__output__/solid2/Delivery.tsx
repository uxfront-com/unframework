import { KeyedFor } from "./_unframework/KeyedFor";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface DeliveryProps {
  speeds: string[];
  extras: string[];
}

export default function Delivery(
  props: DeliveryProps &
    Omit<ComponentProps<"section">, "speeds" | "extras" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "speeds", "extras");

  const [speed, setSpeed] = createState("express");
  const [chosen, setChosen] = createState<string[]>(["insurance"]);

  return (
    <section aria-label="Delivery" {...others}>
      <fieldset>
        <legend>Speed</legend>
        <KeyedFor each={props.speeds} by={(value) => value}>
          {(value) => (
            <label>
              <input
                type="radio"
                name="speed"
                value={value.value}
                checked={speed() === value.value}
                onChange={() => setSpeed(value.value)}
              />{" "}
              {value.value}
            </label>
          )}
        </KeyedFor>
      </fieldset>
      <fieldset>
        <legend>Extras</legend>
        <KeyedFor each={props.extras} by={(extra) => extra}>
          {(extra) => (
            <label>
              <input
                type="checkbox"
                value={extra.value}
                checked={chosen().includes(extra.value)}
                onChange={(event) =>
                  setChosen(toggle(chosen(), extra.value, event.currentTarget.checked))
                }
              />{" "}
              {extra.value}
            </label>
          )}
        </KeyedFor>
      </fieldset>
      <output>
        Speed: {speed()}, extras: {chosen().join(", ") || "none"}
      </output>
    </section>
  );
}

/** The values with `value` added when `checked`, and removed otherwise. */
function toggle<T>(values: readonly T[], value: T, checked: boolean): T[] {
  return checked ? [...values, value] : values.filter((each) => each !== value);
}
