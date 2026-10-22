<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { label: string; value?: number; class?: ClassValue; style?: string };

  let { label, value = $bindable(0), class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={["stepper", className]} {style} {...scopeAttributes(attributes)}>
  <button type="button" aria-label={`Fewer ${label}`} onclick={() => (value -= 1)}>-</button
  ><span>{label}: {value}</span
  ><button type="button" aria-label={`More ${label}`} onclick={() => (value += 1)}>+</button>
</div>
