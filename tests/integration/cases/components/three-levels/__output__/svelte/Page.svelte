<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Section from "./Section.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { name: string; class?: ClassValue; style?: string };

  let { name, class: className, style }: Props = $props();
</script>

<article aria-label="Profile" class={className} {style}>
  <Section title={`About ${name}`} body="Three components deep."
  /><Section title="Contact" body={`Write to ${name}.`} />
</article>
