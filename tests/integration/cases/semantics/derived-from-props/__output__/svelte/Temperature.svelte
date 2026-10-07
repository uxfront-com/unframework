<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { untrack } from "svelte";

  export interface TemperatureProps {
    celsius: number;
  }

  type Props = TemperatureProps & { onreading?: (celsius: number, previous: number) => void };

  let { celsius, onreading }: Props = $props();

  const fahrenheit = $derived(Math.round((celsius * 9) / 5 + 32));
  const level = $derived(celsius >= 30 ? "hot" : celsius <= 5 ? "cold" : "mild");

  let previousCelsius = untrack(() => celsius);
  $effect.pre(() => {
    const value = celsius;
    if (Object.is(value, previousCelsius)) return;
    const previous = previousCelsius;
    previousCelsius = value;
    untrack(() => {
      onreading?.(value, previous);
    });
  });
</script>

<figure class="temperature" data-level={level}>
  <p>{celsius} °C</p
  ><p>{fahrenheit} °F</p
  ><figcaption>Feels {level}</figcaption>
</figure>
