<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, HTMLLabelAttributes } from "svelte/elements";

  type Props = Omit<HTMLLabelAttributes, "label" | "children" | "class" | "style" | "ref"> & {
    label: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["label"] | null;
  };

  let { label, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<label
  class={className}
  {style}
  bind:this={ref}
  {...attributes}
>{label} <input type="text" /></label>
