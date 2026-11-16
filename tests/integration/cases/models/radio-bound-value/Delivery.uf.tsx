import { ref } from "@uxfront/unframework";

export interface DeliveryProps {
  speeds: string[];
  extras: string[];
}

export default function Delivery({ speeds, extras }: DeliveryProps) {
  const speed = ref("express");
  const chosen = ref<string[]>(["insurance"]);
  return (
    <section aria-label="Delivery">
      <fieldset>
        <legend>Speed</legend>
        {speeds.map((value) => (
          <label key={value}>
            <input type="radio" name="speed" value={value} v-model={speed.value} /> {value}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Extras</legend>
        {extras.map((extra) => (
          <label key={extra}>
            <input type="checkbox" value={extra} v-model={chosen.value} /> {extra}
          </label>
        ))}
      </fieldset>
      <output>
        Speed: {speed.value}, extras: {chosen.value.join(", ") || "none"}
      </output>
    </section>
  );
}
