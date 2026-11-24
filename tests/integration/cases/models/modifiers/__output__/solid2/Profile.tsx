import { createState } from "./_unframework/createState";
import { modelText } from "./_unframework/modelText";
import type { ComponentProps, JSX } from "@solidjs/web";
import { untrack } from "solid-js";

export default function Profile(
  props: Omit<ComponentProps<"form">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [name, setName] = createState("");
  const [city, setCity] = createState("Lisbon");
  const [weight, setWeight] = createState(0);

  return (
    <form aria-label="Profile" {...props}>
      <label>
        Name <input value={untrack(name)} ref={modelText(name, setName, { trim: true })} />
      </label>
      <label>
        City <input value={untrack(city)} ref={modelText(city, setCity, { lazy: true })} />
      </label>
      <label>
        Weight{" "}
        <input value={untrack(weight)} ref={modelText(weight, setWeight, { number: true })} />
      </label>
      <output>
        [{name()}] from {city()}, {weight() + 1}
      </output>
    </form>
  );
}
