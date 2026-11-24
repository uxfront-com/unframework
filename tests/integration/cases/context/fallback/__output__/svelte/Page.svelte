<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Greeting from "./Greeting.svelte";
  import LocaleProvider from "./LocaleProvider.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["main"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["main"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<main class={className} {style} bind:this={ref} {...attributes}>
  <Greeting name="Ada" /><LocaleProvider locale="pt"><Greeting name="Inês" /></LocaleProvider>
</main>
