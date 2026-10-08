<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { untrack } from "svelte";

  export interface QuantityStepperProps {
    initial: number;
    label: string;
  }

  let { initial, label }: QuantityStepperProps = $props();

  let quantity = $state(untrack(() => initial));
</script>

<div class="quantity-stepper" role="group" aria-label={label}>
  <output>{quantity}</output
  ><button type="button" aria-label={`Increase ${label}`} onclick={() => quantity++}>+</button>
</div>
