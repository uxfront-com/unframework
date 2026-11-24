<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface DeliveryProps {
    speeds: string[];
    extras: string[];
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "speeds" | "extras" | "children" | "class" | "style" | "ref"
  > &
    DeliveryProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let {
    speeds,
    extras,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  let speed = $state("express");
  let chosen = $state.raw<string[]>(["insurance"]);
</script>

<section aria-label="Delivery" class={className} {style} bind:this={ref} {...attributes}>
  <fieldset>
    <legend>Speed</legend
    >{#each speeds as value (value)}
      <label><input type="radio" name="speed" {value} bind:group={speed} /> {value}</label>
    {/each}
  </fieldset
  ><fieldset>
    <legend>Extras</legend
    >{#each extras as extra (extra)}
      <label><input type="checkbox" value={extra} bind:group={chosen} /> {extra}</label>
    {/each}
  </fieldset
  ><output>Speed: {speed}, extras: {chosen.join(", ") || "none"}</output>
</section>
