<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, HTMLLabelAttributes } from "svelte/elements";

  type Props = Omit<HTMLLabelAttributes, "label" | "children" | "class" | "style"> & {
    label: string;
    class?: ClassValue;
    style?: string;
  };

  let { label, class: className, style, ...attributes }: Props = $props();

  let input: HTMLInputElement | null = null;

  export function focus() {
    input?.focus();
  }
</script>

<label
  class={["search", className]}
  {style}
  {...attributes}
>{label}<input bind:this={input} type="search" /></label>
