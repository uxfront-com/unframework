<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Card from "./Card.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["div"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<div class={["cards", className]} {style} bind:this={ref} {...attributes}>
  <Card label="Full">
    <p>Sunny, 21°</p
    >{#snippet title()}
      <h3>Weather</h3>
    {/snippet}
  </Card
  ><Card label="Bare" />
</div>
