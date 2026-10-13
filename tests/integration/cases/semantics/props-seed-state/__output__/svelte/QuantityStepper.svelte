<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  export interface QuantityStepperProps {
    initial: number;
    label: string;
  }

  type Props = QuantityStepperProps & { class?: ClassValue; style?: string };

  let { initial, label, class: className, style }: Props = $props();

  let quantity = $state(untrack(() => initial));
</script>

<div class={["quantity-stepper", className]} role="group" aria-label={label} {style}>
  <output>{quantity}</output
  ><button type="button" aria-label={`Increase ${label}`} onclick={() => quantity++}>+</button>
</div>
