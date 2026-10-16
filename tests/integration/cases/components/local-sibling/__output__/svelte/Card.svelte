<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import CardIcon from "./CardIcon.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { title: string; class?: ClassValue; style?: string };

  let { title, class: className, style }: Props = $props();
</script>

<div class={["card", className]} {style}>
  <CardIcon symbol="+"
  /><h3>{title}</h3
  ><CardIcon symbol="-" />
</div>
