<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Level from "./Level.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();
</script>

<Level title="Book" class={className} {style}>
  <Level title="Part"><Level title="Chapter" /></Level><Level title="Appendix" />
</Level>
