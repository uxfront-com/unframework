<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();

  let plan = $state("monthly");
</script>

<fieldset class={className} {style}>
  <legend>Billing</legend
  ><label><input type="radio" name="plan" value="monthly" bind:group={plan} /> Monthly</label
  ><label><input type="radio" name="plan" value="yearly" bind:group={plan} /> Yearly</label
  ><output>Plan: {plan}</output
  ><button type="button" onclick={() => (plan = "monthly")}>Reset</button>
</fieldset>
