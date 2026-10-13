<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Field from "./Field.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { city: string; class?: ClassValue; style?: string };

  let { city, class: className, style }: Props = $props();

  let cleared = $state("nothing");

  function clear(label: string) {
    cleared = label;
  }
</script>

<section aria-label="Address" class={className} {style}>
  <Field label="Street" onclear={clear}
  /><Field label={city} tone="warn" onclear={(label) => clear(label.toUpperCase())}
  /><output>Cleared: {cleared}</output>
</section>
