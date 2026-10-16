<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  export interface TemperatureProps {
    celsius: number;
  }

  type Props = TemperatureProps & {
    onreading?: (celsius: number, previous: number) => void;
    class?: ClassValue;
    style?: string;
  };

  let { celsius, onreading, class: className, style }: Props = $props();

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

<figure class={["temperature", className]} data-level={level} {style}>
  <p>{celsius} °C</p
  ><p>{fahrenheit} °F</p
  ><figcaption>Feels {level}</figcaption>
</figure>
