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

  let { celsius, onreading, class: className, style, ...attributes }: Props = $props();

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

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<figure
  class={["temperature", className]}
  data-level={level}
  {style}
  {...scopeAttributes(attributes)}
>
  <p>{celsius} °C</p
  ><p>{fahrenheit} °F</p
  ><figcaption>Feels {level}</figcaption>
</figure>
