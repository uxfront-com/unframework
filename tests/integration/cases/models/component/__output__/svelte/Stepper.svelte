<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["div"],
    "label" | "value" | "children" | "class" | "style" | "ref"
  > & {
    label: string;
    value?: number;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let {
    label,
    value = $bindable(0),
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<div class={["stepper", className]} {style} bind:this={ref} {...attributes}>
  <button type="button" aria-label={`Fewer ${label}`} onclick={() => (value -= 1)}>-</button
  ><span>{label}: {value}</span
  ><button type="button" aria-label={`More ${label}`} onclick={() => (value += 1)}>+</button>
</div>
