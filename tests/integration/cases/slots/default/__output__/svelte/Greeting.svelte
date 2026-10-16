<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Panel from "./Panel.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { name: string; class?: ClassValue; style?: string };

  let { name, class: className, style }: Props = $props();
</script>

<Panel title="Welcome" class={className} {style}>
  <p>Hello, <strong>{name}</strong>!</p
  ><p>Your children render in the panel.</p>
</Panel>
