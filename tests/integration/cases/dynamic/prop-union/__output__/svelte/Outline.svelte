<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Heading from "./Heading.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();
</script>

<main class={className} {style}>
  <Heading tag="h1" text="Guide" /><Heading tag="h2" text="Setup"
  /><Heading tag="h3" text="Requirements" />
</main>
