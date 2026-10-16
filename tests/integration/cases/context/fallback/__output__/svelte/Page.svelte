<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Greeting from "./Greeting.svelte";
  import LocaleProvider from "./LocaleProvider.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();
</script>

<main class={className} {style}>
  <Greeting name="Ada" /><LocaleProvider locale="pt"><Greeting name="Inês" /></LocaleProvider>
</main>
