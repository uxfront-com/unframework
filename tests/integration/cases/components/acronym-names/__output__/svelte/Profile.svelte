<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Avatar from "./Avatar.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["div"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let picked = $state("none");
</script>

<div class={className} {style} bind:this={ref} {...attributes}>
  <Avatar imageURL="/a.png" userID={7} onpickedurl={(url) => (picked = url)}
  /><output>Picked: {picked}</output>
</div>
