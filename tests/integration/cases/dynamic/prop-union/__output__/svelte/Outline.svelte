<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Heading from "./Heading.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["main"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["main"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<main class={className} {style} bind:this={ref} {...attributes}>
  <Heading tag="h1" text="Guide" /><Heading tag="h2" text="Setup"
  /><Heading tag="h3" text="Requirements" />
</main>
