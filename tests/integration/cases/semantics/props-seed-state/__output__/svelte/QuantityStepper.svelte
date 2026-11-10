<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface QuantityStepperProps {
    initial: number;
    label: string;
  }
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = QuantityStepperProps & { class?: ClassValue; style?: string };

  let { initial, label, class: className, style, ...attributes }: Props = $props();

  let quantity = $state(untrack(() => initial));

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div
  class={["quantity-stepper", className]}
  role="group"
  aria-label={label}
  {style}
  {...scopeAttributes(attributes)}
>
  <output>{quantity}</output
  ><button type="button" aria-label={`Increase ${label}`} onclick={() => quantity++}>+</button>
</div>
