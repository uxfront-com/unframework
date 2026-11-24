<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";
  import "./Tag.uf.tsx.css";

  type Props = Omit<SvelteHTMLElements["span"], "name" | "children" | "class" | "style" | "ref"> & {
    name: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["span"] | null;
  };

  let { name, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<span
  class={["tag", className]}
  {style}
  data-uf-ef5e671c=""
  bind:this={ref}
  {...attributes}
>{name}</span>
