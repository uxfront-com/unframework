<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import CardIcon from "./CardIcon.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["div"], "title" | "children" | "class" | "style" | "ref"> & {
    title: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let { title, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<div class={["card", className]} {style} bind:this={ref} {...attributes}>
  <CardIcon symbol="+"
  /><h3>{title}</h3
  ><CardIcon symbol="-" />
</div>
