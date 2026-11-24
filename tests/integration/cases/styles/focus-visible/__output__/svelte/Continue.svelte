<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, HTMLButtonAttributes } from "svelte/elements";
  import "./Continue.uf.tsx.css";

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
  class={["continue", className]}
  {style}
  data-uf-bb3adc28=""
  bind:this={ref}
  {...attributes}
>{text}</button>
