<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Primary from "./Primary.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["div"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<div role="toolbar" aria-label="Actions" class={className} {style} bind:this={ref} {...attributes}>
  <Primary text="Save" class="wide" />
</div>
