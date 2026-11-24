<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface TemperatureProps {
    celsius: number;
  }
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["figure"],
    "celsius" | "onreading" | "children" | "class" | "style" | "ref"
  > &
    TemperatureProps & {
      onreading?: (celsius: number, previous: number) => void;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["figure"] | null;
    };

  let {
    celsius,
    onreading,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

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

<figure
  class={["temperature", className]}
  data-level={level}
  {style}
  bind:this={ref}
  {...attributes}
>
  <p>{celsius} °C</p
  ><p>{fahrenheit} °F</p
  ><figcaption>Feels {level}</figcaption>
</figure>
