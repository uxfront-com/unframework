<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface QuantityStepperProps {
    initial: number;
    label: string;
  }
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["div"],
    "initial" | "label" | "children" | "class" | "style" | "ref"
  > &
    QuantityStepperProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["div"] | null;
    };

  let {
    initial,
    label,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  let quantity = $state(untrack(() => initial));
</script>

<div
  class={["quantity-stepper", className]}
  role="group"
  aria-label={label}
  {style}
  bind:this={ref}
  {...attributes}
>
  <output>{quantity}</output
  ><button type="button" aria-label={`Increase ${label}`} onclick={() => quantity++}>+</button>
</div>
