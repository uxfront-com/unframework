import { type QRL, component$, useComputed$, useSignal, useTask$ } from "@qwik.dev/core";

export interface TemperatureProps {
  celsius: number;
}

export interface TemperatureEvents {
  onReading$?: QRL<(celsius: number, previous: number) => void>;
}

export default component$<TemperatureProps & TemperatureEvents>(({ celsius, onReading$ }) => {
  const fahrenheit = useComputed$(() => Math.round((celsius * 9) / 5 + 32));
  const level = useComputed$(() => (celsius >= 30 ? "hot" : celsius <= 5 ? "cold" : "mild"));

  const previousCelsius = useSignal(() => celsius);
  useTask$(
    ({ track }) => {
      const value = track(() => celsius);
      const previous = previousCelsius.value;
      if (Object.is(value, previous)) return;
      previousCelsius.value = value;
      onReading$?.(value, previous);
    },
    { deferUpdates: false },
  );

  return (
    <figure class="temperature" data-level={level.value}>
      <p>{celsius} °C</p>
      <p>{fahrenheit.value} °F</p>
      <figcaption>Feels {level.value}</figcaption>
    </figure>
  );
});
