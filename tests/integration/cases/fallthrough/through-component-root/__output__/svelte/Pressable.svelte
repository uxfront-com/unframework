<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, HTMLButtonAttributes } from "svelte/elements";

  type Props = Omit<HTMLButtonAttributes, "text" | "children" | "class" | "style" | "ref"> & {
    text: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["button"] | null;
  };

  let { text, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<button
  type="button"
  class={["pressable", className]}
  {style}
  bind:this={ref}
  {...attributes}
>{text}</button>
