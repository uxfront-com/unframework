import { type ComponentPropsWithRef, useState } from "react";

export interface DeliveryProps {
  speeds: string[];
  extras: string[];
}

export type DeliveryAttributes = Omit<
  ComponentPropsWithRef<"section">,
  "speeds" | "extras" | "children"
>;

export default function Delivery({
  speeds,
  extras,
  className,
  style,
  ...attributes
}: DeliveryProps & DeliveryAttributes) {
  const [speed, setSpeed] = useState("express");
  const [chosen, setChosen] = useState<string[]>(["insurance"]);

  return (
    <section aria-label="Delivery" className={className} style={style} {...attributes}>
      <fieldset>
        <legend>Speed</legend>
        {speeds.map((value) => (
          <label key={value}>
            <input
              type="radio"
              name="speed"
              value={value}
              checked={speed === value}
              onChange={() => setSpeed(value)}
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
              checked={chosen.includes(extra)}
              onChange={(event) => setChosen(toggle(chosen, extra, event.target.checked))}
            />{" "}
            {extra}
          </label>
        ))}
      </fieldset>
      <output>
        Speed: {speed}, extras: {chosen.join(", ") || "none"}
      </output>
    </section>
  );
}

/** The array with `value` added when `checked`, and without it otherwise. */
function toggle<T>(values: T[], value: T, checked: boolean): T[] {
  const index = values.indexOf(value);
  if (checked && index === -1) return [...values, value];
  if (!checked && index !== -1) return values.filter((_, at) => at !== index);
  return values;
}
