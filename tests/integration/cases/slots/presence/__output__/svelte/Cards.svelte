<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Card from "./Card.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();
</script>

<div class={["cards", className]} {style}>
  <Card label="Full">
    <p>Sunny, 21°</p
    >{#snippet title()}
      <h3>Weather</h3>
    {/snippet}
  </Card
  ><Card label="Bare" />
</div>
