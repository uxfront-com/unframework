<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Steps from "./Steps.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { steps: string[]; class?: ClassValue; style?: string };

  let { steps, class: className, style }: Props = $props();
</script>

<div class={className} {style}>
  <Steps {steps}>
    {#snippet marker()}
      <span aria-hidden="true">{"\u003e "}</span>
    {/snippet}
  </Steps>
</div>
